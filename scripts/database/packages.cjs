const { createHash } = require("node:crypto");
const { readFileSync, readdirSync } = require("node:fs");
const { resolve } = require("node:path");
const optionalModuleIds = require("../../backend/prisma/module-catalog.json");

function readSelectedManifests(projectRoot) {
  const selection = JSON.parse(
    readFileSync(resolve(projectRoot, "database-packages.json"), "utf8"),
  );
  if (
    !Array.isArray(selection.modules) ||
    selection.modules.some((id) => !optionalModuleIds.includes(id)) ||
    new Set(selection.modules).size !== selection.modules.length
  ) {
    throw new Error(
      `database-packages.json: modules must contain unique ${optionalModuleIds.join("/")} identifiers`,
    );
  }
  const manifests = new Map();
  const ordered = [];
  const visiting = new Set();
  const stack = [];
  function load(id) {
    if (visiting.has(id))
      throw new Error(
        `Circular database package dependency: ${[...stack.slice(stack.indexOf(id)), id].join(" → ")}`,
      );
    if (manifests.has(id)) return manifests.get(id);

    const manifest = JSON.parse(
      readFileSync(
        resolve(projectRoot, "backend/prisma/packages", id, "manifest.json"),
        "utf8",
      ),
    );
    const dependencies = manifest.requiresPackages ?? {};
    if (
      manifest.id !== id ||
      !Number.isSafeInteger(manifest.version) ||
      manifest.version < 1 ||
      (id === "core" && manifest.version !== 1) ||
      typeof dependencies !== "object" ||
      Array.isArray(dependencies) ||
      (id === "core" && Object.keys(dependencies).length > 0)
    )
      throw new Error(`Invalid database package: ${id}`);

    visiting.add(id);
    stack.push(id);
    manifests.set(id, manifest);
    for (const [dependency, version] of Object.entries(dependencies).sort(
      ([a], [b]) => a.localeCompare(b),
    )) {
      if (
        !optionalModuleIds.includes(dependency) ||
        !Number.isSafeInteger(version) ||
        version < 1
      )
        throw new Error(
          `Invalid database package dependency: ${id} → ${dependency}`,
        );
      const actual = load(dependency).version;
      if (actual !== version)
        throw new Error(
          `Database package ${id} requires ${dependency}@${version}, found ${actual}`,
        );
    }
    visiting.delete(id);
    stack.pop();
    ordered.push(manifest);
    return manifest;
  }
  for (const id of ["core", ...[...selection.modules].sort()]) load(id);
  return ordered;
}

function readPackageSelection(projectRoot) {
  return readSelectedManifests(projectRoot)
    .slice(1)
    .map(({ id }) => id);
}

function readPackageSet(projectRoot) {
  const packages = readSelectedManifests(projectRoot).map((manifest) => {
    const { id } = manifest;
    const directory = resolve(projectRoot, "backend/prisma/packages", id);
    const validCoreRequirement =
      id === "core"
        ? manifest.requiresCore === null
        : manifest.requiresCore === 1;
    if (
      !validCoreRequirement ||
      !Array.isArray(manifest.migrations) ||
      !manifest.migrations.length
    ) {
      throw new Error(`Invalid database package: ${id}`);
    }
    const declared = manifest.migrations.map((entry) => entry.id).sort();
    const found = readdirSync(resolve(directory, "migrations")).sort();
    if (JSON.stringify(declared) !== JSON.stringify(found))
      throw new Error(`Migration manifest mismatch: ${id}`);
    const migrations = [...manifest.migrations]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((entry) => {
        if (
          !/^\d{14}_[a-z0-9_]+$/.test(entry.id) ||
          !/^[a-f0-9]{64}$/.test(entry.sha256)
        )
          throw new Error(`Invalid migration identity: ${id}`);
        const sql = readFileSync(
          resolve(directory, "migrations", entry.id, "migration.sql"),
        );
        if (createHash("sha256").update(sql).digest("hex") !== entry.sha256)
          throw new Error(`Migration checksum mismatch: ${entry.id}`);
        return { ...entry, sql, packageId: id };
      });
    return { ...manifest, migrations };
  });
  const migrations = packages.flatMap((entry) => entry.migrations);
  if (new Set(migrations.map((entry) => entry.id)).size !== migrations.length)
    throw new Error("Duplicate migration identity");
  return { packages, migrations };
}

module.exports = { readPackageSet, readPackageSelection };
