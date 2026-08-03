export function createRegisteredProcess({ child, name }) {
  let closed = false;
  let exited = child.exitCode !== null || child.signalCode !== null;
  let processError = null;
  let closeResolve;
  const closePromise = new Promise((resolveClose) => {
    closeResolve = resolveClose;
  });

  const markClosed = (code = child.exitCode, signal = child.signalCode) => {
    closed = true;
    closeResolve({ code, signal });
  };

  child.once('error', (error) => {
    processError = error;

    if (!child.pid) {
      markClosed(null, null);
    }
  });
  child.once('close', markClosed);
  child.once('exit', () => {
    exited = true;
  });

  return {
    child,
    get closed() {
      return closed;
    },
    get exited() {
      return exited;
    },
    get processError() {
      return processError;
    },
    closePromise,
    name,
  };
}

export function waitForClose(closePromise, timeoutMs) {
  return new Promise((resolveWait) => {
    const timeout = setTimeout(() => {
      resolveWait(null);
    }, timeoutMs);

    closePromise.then((result) => {
      clearTimeout(timeout);
      resolveWait(result);
    });
  });
}
