import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import packageTools from "../../../../scripts/database/packages.cjs";
import { validateHistory } from "../../../../scripts/database/migrate.mjs";

const root = resolve(import.meta.dirname, "../../../..");

test("package manifests validate package versions and dependencies", async () => {
  const fixture = await mkdtemp(resolve(tmpdir(), "esoft-manifest-test-"));
  try {
    await cp(
      resolve(root, "backend/prisma/packages/core"),
      resolve(fixture, "backend/prisma/packages/core"),
      { recursive: true },
    );
    await cp(
      resolve(root, "backend/prisma/packages/equipment"),
      resolve(fixture, "backend/prisma/packages/equipment"),
      { recursive: true },
    );
    await cp(
      resolve(root, "backend/prisma/packages/warehouse"),
      resolve(fixture, "backend/prisma/packages/warehouse"),
      { recursive: true },
    );
    await cp(
      resolve(root, "backend/prisma/packages/orders"),
      resolve(fixture, "backend/prisma/packages/orders"),
      { recursive: true },
    );
    await cp(
      resolve(root, "backend/prisma/packages/ppe"),
      resolve(fixture, "backend/prisma/packages/ppe"),
      { recursive: true },
    );
    const catalog = JSON.parse(
      await readFile(
        resolve(root, "backend/prisma/module-catalog.json"),
        "utf8",
      ),
    );
    await writeFile(
      resolve(fixture, "database-packages.json"),
      JSON.stringify({ modules: catalog }),
    );
    assert.deepEqual(
      packageTools.readPackageSelection(fixture),
      [...catalog].sort(),
    );
    for (const modules of [["unknown"], [catalog[0], catalog[0]]]) {
      await writeFile(
        resolve(fixture, "database-packages.json"),
        JSON.stringify({ modules }),
      );
      assert.throws(
        () => packageTools.readPackageSelection(fixture),
        /modules must contain unique/,
      );
    }
    await writeFile(
      resolve(fixture, "database-packages.json"),
      '{"modules":["equipment","warehouse"]}',
    );
    const corePath = resolve(
      fixture,
      "backend/prisma/packages/core/manifest.json",
    );
    const core = JSON.parse(await readFile(corePath, "utf8"));
    assert.deepEqual(
      packageTools.readPackageSet(fixture).packages.map(({ id }) => id),
      ["core", "equipment", "orders", "warehouse"],
    );
    const ordersPath = resolve(
      fixture,
      "backend/prisma/packages/orders/manifest.json",
    );
    const orders = JSON.parse(await readFile(ordersPath, "utf8"));
    await writeFile(ordersPath, JSON.stringify({ ...orders, version: 2 }));
    assert.throws(
      () => packageTools.readPackageSet(fixture),
      /warehouse requires orders@1, found 2/,
    );
    await writeFile(ordersPath, JSON.stringify(orders));
    await writeFile(
      ordersPath,
      JSON.stringify({ ...orders, requiresPackages: { warehouse: 1 } }),
    );
    assert.throws(() => packageTools.readPackageSet(fixture), {
      message:
        "Circular database package dependency: warehouse → orders → warehouse",
    });
    const equipmentPath = resolve(
      fixture,
      "backend/prisma/packages/equipment/manifest.json",
    );
    const equipment = JSON.parse(await readFile(equipmentPath, "utf8"));
    const warehousePath = resolve(
      fixture,
      "backend/prisma/packages/warehouse/manifest.json",
    );
    const warehouse = JSON.parse(await readFile(warehousePath, "utf8"));
    await writeFile(
      equipmentPath,
      JSON.stringify({ ...equipment, requiresPackages: { orders: 1 } }),
    );
    await writeFile(
      warehousePath,
      JSON.stringify({ ...warehouse, requiresPackages: { equipment: 1 } }),
    );
    assert.throws(() => packageTools.readPackageSet(fixture), {
      message:
        "Circular database package dependency: equipment → orders → warehouse → equipment",
    });
    await writeFile(equipmentPath, JSON.stringify(equipment));
    await writeFile(warehousePath, JSON.stringify(warehouse));
    await writeFile(ordersPath, JSON.stringify(orders));
    for (const requiresCore of [999, 1, undefined, "null", false]) {
      await writeFile(corePath, JSON.stringify({ ...core, requiresCore }));
      assert.throws(
        () => packageTools.readPackageSet(fixture),
        /Invalid database package: core/,
      );
    }
    await writeFile(
      corePath,
      JSON.stringify({ ...core, version: 2, requiresCore: null }),
    );
    assert.throws(
      () => packageTools.readPackageSet(fixture),
      /Invalid database package: core/,
    );
    await writeFile(corePath, JSON.stringify({ ...core, requiresCore: null }));
    assert.doesNotThrow(() => packageTools.readPackageSet(fixture));
    const modulePath = resolve(
      fixture,
      "backend/prisma/packages/equipment/manifest.json",
    );
    const module = JSON.parse(await readFile(modulePath, "utf8"));
    await writeFile(
      modulePath,
      JSON.stringify({ ...module, requiresCore: null }),
    );
    assert.throws(
      () => packageTools.readPackageSet(fixture),
      /Invalid database package: equipment/,
    );
    await writeFile(
      modulePath,
      JSON.stringify({ ...module, version: 0, requiresCore: 1 }),
    );
    assert.throws(
      () => packageTools.readPackageSet(fixture),
      /Invalid database package: equipment/,
    );
    await writeFile(modulePath, JSON.stringify({ ...module, requiresCore: 1 }));
    assert.doesNotThrow(() => packageTools.readPackageSet(fixture));
  } finally {
    assert.equal(dirname(resolve(fixture)), resolve(tmpdir()));
    assert.ok(basename(fixture).startsWith("esoft-manifest-test-"));
    await rm(fixture, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 200,
    });
  }
});
test("history preflight rejects missing, changed and failed SQL", () => {
  const file = { id: "20260725000000_core_init", sha256: "a".repeat(64) };
  const applied = {
    migration_name: file.id,
    checksum: file.sha256,
    finished_at: new Date(),
    rolled_back_at: null,
  };
  assert.doesNotThrow(() => validateHistory([applied], [file]));
  assert.throws(() => validateHistory([applied], []), /missing/);
  assert.throws(
    () => validateHistory([{ ...applied, checksum: "b".repeat(64) }], [file]),
    /checksum/,
  );
  assert.throws(
    () => validateHistory([{ ...applied, finished_at: null }], [file]),
    /incomplete/,
  );
  assert.doesNotThrow(() =>
    validateHistory([{ ...applied, rolled_back_at: new Date() }], []),
  );
});

