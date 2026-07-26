export function success(code, message, details = undefined) {
  return createResult(true, code, message, details);
}

export function failure(code, message, details = undefined) {
  return createResult(false, code, message, details);
}

export function combineResults(
  results,
  {
    failureCode = 'OPERATIONS_FAILED',
    failureMessage = 'One or more operations failed',
    successCode = 'OPERATIONS_COMPLETED',
    successMessage = 'All operations completed successfully',
  } = {},
) {
  const ok = results.every((result) => result.ok);

  return createResult(
    ok,
    ok ? successCode : failureCode,
    ok ? successMessage : failureMessage,
    { results: results.map((result) => snapshotValue(result)) },
  );
}

function createResult(ok, code, message, details) {
  return {
    ok,
    code,
    message,
    ...(details === undefined ? {} : { details }),
  };
}

function snapshotValue(value, seen = new WeakMap()) {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (seen.has(value)) {
    return seen.get(value);
  }

  if (Array.isArray(value)) {
    const clone = [];
    seen.set(value, clone);

    for (const item of value) {
      clone.push(snapshotValue(item, seen));
    }

    return clone;
  }

  const clone = {};
  seen.set(value, clone);

  for (const [key, nestedValue] of Object.entries(value)) {
    Object.defineProperty(clone, key, {
      configurable: true,
      enumerable: true,
      value: snapshotValue(nestedValue, seen),
      writable: true,
    });
  }

  return clone;
}
