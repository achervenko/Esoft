const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const { resolve } = require('node:path');

// Atomic, installation-wide lease. Never remove a lock owned by another process.
function acquireInstallationLock({ projectRoot, operation, filesystem = fs, recoverBackend = false, probeProcess = (pid) => process.kill(pid, 0) }) {
  const {
    mkdirSync,
    openSync,
    writeFileSync,
    closeSync,
    readFileSync,
    unlinkSync,
    fstatSync,
    lstatSync,
  } = filesystem;
  const root = resolve(projectRoot, '.local');
  const lockPath = resolve(root, '.production-operation.lock');
  mkdirSync(root, { recursive: true });
  const token = randomUUID();
  let fd;
  try {
    fd = openSync(lockPath, 'wx', 0o600);
  } catch (error) {
    if (error.code !== 'EEXIST' || operation !== 'backend' || !recoverBackend) throw error;
    const identity = lstatSync(lockPath);
    const raw = readFileSync(lockPath, 'utf8');
    const owner = JSON.parse(raw);
    if (identity.isSymbolicLink() || owner.operation !== 'backend' ||
        !Number.isSafeInteger(owner.pid) || owner.pid <= 0 || !owner.token) throw error;
    try {
      probeProcess(owner.pid);
      throw error;
    } catch (probeError) {
      if (probeError.code !== 'ESRCH') throw error;
    }
    const current = lstatSync(lockPath);
    if (current.dev !== identity.dev || current.ino !== identity.ino ||
        readFileSync(lockPath, 'utf8') !== raw) throw error;
    unlinkSync(lockPath);
    fd = openSync(lockPath, 'wx', 0o600);
  }
  let identity;
  let initializationError;
  try {
    identity = fstatSync(fd);
    writeFileSync(
      fd,
      JSON.stringify({
        token,
        operation,
        pid: process.pid,
        createdAt: new Date().toISOString(),
      }),
    );
  } catch (error) {
    initializationError = error;
  }
  try {
    closeSync(fd);
  } catch (error) {
    throw initializationCleanupError(lockPath, error, initializationError);
  }
  if (initializationError) {
    try {
      const current = lstatSync(lockPath);
      if (
        !identity ||
        current.isSymbolicLink() ||
        current.dev !== identity.dev ||
        current.ino !== identity.ino
      )
        throw new Error('Installation lock file identity changed');
      unlinkSync(lockPath);
    } catch (error) {
      throw initializationCleanupError(lockPath, error, initializationError);
    }
    throw initializationError;
  }
  let released = false;
  const lease = {
    lockPath,
    release() {
      if (released) return;
      const owner = JSON.parse(readFileSync(lockPath, 'utf8'));
      if (owner.token !== token)
        throw new Error('Production operation lock owner changed');
      unlinkSync(lockPath);
      released = true;
    },
  };
  if (operation === 'backend') {
    const recoveryStatePath = resolve(root, '.restore-recovery-required.json');
    let pending = false;
    try {
      lstatSync(recoveryStatePath);
      pending = true;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        lease.release();
        throw error;
      }
    }
    if (pending) {
      lease.release();
      const error = new Error(
        'Unfinished restore requires recovery before backend can start',
      );
      error.code = 'INSTALLATION_RECOVERY_REQUIRED';
      error.recoveryStatePath = recoveryStatePath;
      throw error;
    }
  }
  return lease;
}

function initializationCleanupError(
  lockPath,
  cleanupError,
  initializationError,
) {
  const error = new Error(
    'Unable to clean up installation lock after initialization failure',
    { cause: initializationError ?? cleanupError },
  );
  error.code = 'INSTALLATION_LOCK_CLEANUP_FAILED';
  error.lockPath = lockPath;
  error.cleanupError = cleanupError;
  return error;
}

module.exports = { acquireInstallationLock };
