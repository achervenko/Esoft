const { createHash } = require('node:crypto');
const { readFileSync, readdirSync } = require('node:fs');
const { resolve } = require('node:path');

function readPackageSelection(projectRoot) {
  const selection = JSON.parse(readFileSync(resolve(projectRoot, 'database-packages.json'), 'utf8'));
  if (!Array.isArray(selection.modules) || selection.modules.some((id) => !['equipment', 'ppe', 'warehouse'].includes(id)) || new Set(selection.modules).size !== selection.modules.length) {
    throw new Error('database-packages.json: modules must contain unique equipment/ppe/warehouse identifiers');
  }
  return selection.modules;
}

function readPackageSet(projectRoot) {
  const packages = ['core', ...readPackageSelection(projectRoot)].map((id) => {
    const directory = resolve(projectRoot, 'backend/prisma/packages', id);
    const manifest = JSON.parse(readFileSync(resolve(directory, 'manifest.json'), 'utf8'));
    const validCoreRequirement =
      id === 'core'
        ? manifest.requiresCore === null
        : manifest.requiresCore === 1;
    if (
      manifest.id !== id ||
      manifest.version !== 1 ||
      !validCoreRequirement ||
      !Array.isArray(manifest.migrations) ||
      !manifest.migrations.length
    ) {
      throw new Error(`Invalid database package: ${id}`);
    }
    const declared = manifest.migrations.map((entry) => entry.id).sort();
    const found = readdirSync(resolve(directory, 'migrations')).sort();
    if (JSON.stringify(declared) !== JSON.stringify(found)) throw new Error(`Migration manifest mismatch: ${id}`);
    const migrations = manifest.migrations.map((entry) => {
      if (!/^\d{14}_[a-z0-9_]+$/.test(entry.id) || !/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error(`Invalid migration identity: ${id}`);
      const sql = readFileSync(resolve(directory, 'migrations', entry.id, 'migration.sql'));
      if (createHash('sha256').update(sql).digest('hex') !== entry.sha256) throw new Error(`Migration checksum mismatch: ${entry.id}`);
      return { ...entry, sql, packageId: id };
    });
    return { ...manifest, migrations };
  });
  const migrations = packages.flatMap((entry) => entry.migrations).sort((a, b) => a.id.localeCompare(b.id));
  if (new Set(migrations.map((entry) => entry.id)).size !== migrations.length) throw new Error('Duplicate migration identity');
  return { packages, migrations };
}

module.exports = { readPackageSet, readPackageSelection };
