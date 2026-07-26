export function snapshotEnvironment() {
  return { ...process.env };
}

export function restoreEnvironment(snapshot) {
  if (
    snapshot === null ||
    typeof snapshot !== 'object' ||
    Array.isArray(snapshot)
  ) {
    throw new TypeError('snapshot must be an environment snapshot object');
  }

  for (const key of Object.keys(process.env)) {
    if (!Object.hasOwn(snapshot, key)) {
      delete process.env[key];
    }
  }

  for (const [key, value] of Object.entries(snapshot)) {
    process.env[key] = value;
  }
}

export async function withEnvironment(callback) {
  const snapshot = snapshotEnvironment();

  try {
    return await callback();
  } finally {
    restoreEnvironment(snapshot);
  }
}
