export function beginStartupOperation(cleanupState) {
  if (!cleanupState) {
    return () => undefined;
  }

  if (cleanupState.started) {
    throw new Error('Cleanup has already started');
  }

  cleanupState.activeStartups = getActiveStartupCount(cleanupState) + 1;
  notifyCleanupStateChanged(cleanupState);

  let finished = false;

  return () => {
    if (finished) {
      return;
    }

    finished = true;
    cleanupState.activeStartups = Math.max(
      0,
      getActiveStartupCount(cleanupState) - 1,
    );
    notifyCleanupStateChanged(cleanupState);
  };
}

export function getActiveStartupCount(cleanupState) {
  return cleanupState?.activeStartups ?? 0;
}

export function getCleanupStateVersion(cleanupState) {
  return cleanupState?.version ?? 0;
}

export function notifyCleanupStateChanged(cleanupState) {
  if (!cleanupState) {
    return;
  }

  cleanupState.version = getCleanupStateVersion(cleanupState) + 1;
  const waiters = cleanupState?.waiters;

  if (!waiters) {
    return;
  }

  cleanupState.waiters = new Set();

  for (const resolveWaiter of waiters) {
    resolveWaiter();
  }
}

export function waitForCleanupStateChange(cleanupState, observedVersion) {
  if (getCleanupStateVersion(cleanupState) !== observedVersion) {
    return Promise.resolve();
  }

  cleanupState.waiters ??= new Set();

  return new Promise((resolveWaiter) => {
    cleanupState.waiters.add(resolveWaiter);

    if (getCleanupStateVersion(cleanupState) !== observedVersion) {
      cleanupState.waiters.delete(resolveWaiter);
      resolveWaiter();
    }
  });
}
