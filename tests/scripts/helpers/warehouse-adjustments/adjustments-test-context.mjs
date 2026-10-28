import assert from "node:assert/strict";
import { cp, mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { createIsolatedPostgres } from "../isolated-postgres.mjs";
import { runPackageMigrations } from "../../../../scripts/database/migrate.mjs";

const require = createRequire(import.meta.url);
const project = resolve(import.meta.dirname, "../../../..");
export const code = (expected) => (error) => {
  assert.equal(error.response?.code, expected);
  return true;
};

export { createIsolatedPostgres as createAdjustmentsTestEnvironment };
export const load = (path) => require(join(project, "backend/dist/src", path));

export async function withAdjustmentsContext(
  env,
  name,
  testCase,
  { initialQuantity = "20" } = {},
) {
  const { PrismaClient } = require("@prisma/client");
  const { PrismaPg } = require("@prisma/adapter-pg");
  const { WarehouseStockService } = load("warehouse/stock/stock.service.js");
  const { WarehouseStockQueryService } = load(
    "warehouse/stock/stock-query.service.js",
  );
  const { WarehouseStockAdjustmentsService } = load(
    "warehouse/adjustments/adjustments.service.js",
  );
  const { WarehouseStockAdjustmentAccessService } = load(
    "warehouse/adjustments/adjustment-access.service.js",
  );
  const { WarehouseStockAdjustmentCommandService } = load(
    "warehouse/adjustments/adjustment-command.service.js",
  );
  const { WarehouseStockAdjustmentDocumentService } = load(
    "warehouse/adjustments/adjustment-document.service.js",
  );
  const { WarehouseStockAdjustmentQueryService } = load(
    "warehouse/adjustments/adjustment-query.service.js",
  );
  const { StorageStagedUploadService } = load(
    "storage/storage-staged-upload.service.js",
  );
  const { StorageFilePolicyService } = load(
    "storage/storage-file-policy.service.js",
  );
  const { AuditLogService } = load("audit/audit-log.service.js");
  const root = join(env.root, name);
  await mkdir(join(root, "backend/prisma"), { recursive: true });
  await cp(
    join(project, "backend/prisma/schema"),
    join(root, "backend/prisma/schema"),
    { recursive: true },
  );
  for (const id of ["core", "warehouse"])
    await cp(
      join(project, "backend/prisma/packages", id),
      join(root, "backend/prisma/packages", id),
      { recursive: true },
    );
  await writeFile(
    join(root, "database-packages.json"),
    '{"modules":["warehouse"]}',
  );
  await env.database(name);
  const url = env.urlFor(name);
  const deploy = await runPackageMigrations({
    projectRoot: root,
    databaseUrl: url,
    operation: "deploy",
    output: { log() {} },
  });
  assert.equal(deploy.ok, true, deploy.stdout + deploy.stderr);
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });
  const storage = {
    bytes: new Map(),
    failDelete: false,
    failPut: false,
    deletes: 0,
  };
  const objects = {
    bucket: "adjustments-test",
    async putObject({ key, body }) {
      storage.bytes.set(key, Buffer.from(body));
      if (storage.failPut) throw new Error("Injected ambiguous upload failure");
      return { bucket: this.bucket, key };
    },
    async deleteObject(key, bucket) {
      assert.equal(bucket, this.bucket);
      storage.deletes++;
      if (storage.failDelete) throw new Error("Injected cleanup failure");
      storage.bytes.delete(key);
    },
    async getObject(key) {
      assert.ok(storage.bytes.has(key));
      return {
        body: Readable.from(storage.bytes.get(key)),
        contentType: "application/pdf",
        contentLength: storage.bytes.get(key).length,
      };
    },
  };

  try {
    const admin = await prisma.user.create({
      data: {
        id: "adjust-admin",
        name: "Admin",
        email: "adjust-admin@test.invalid",
        role: "admin,storekeeper",
      },
    });
    const keeper = await prisma.user.create({
      data: {
        id: "adjust-keeper",
        name: "Keeper",
        email: "adjust-keeper@test.invalid",
        role: "storekeeper",
      },
    });
    const secondAdmin = await prisma.user.create({
      data: {
        id: "adjust-other",
        name: "Admin",
        email: "adjust-other@test.invalid",
        role: "admin",
      },
    });
    const item = await prisma.warehouseItem.create({
      data: {
        id: 9007199254740993n,
        article: "ADJUST-A",
        name: "Bearing",
        unit: "шт",
      },
    });
    const location = await prisma.warehouseStorageLocation.create({
      data: {
        warehouse: {
          connectOrCreate: {
            where: { name: "TEST" },
            create: { name: "TEST" },
          },
        },
        id: 9007199254740993n,

        name: "Shelf",
      },
    });
    const audit = new AuditLogService(prisma);
    const stock = new WarehouseStockService(
      new WarehouseStockQueryService(prisma),
      audit,
    );
    const policy = new StorageFilePolicyService({
      primaryDocumentTypes: [],
      singleDocumentTypes: [],
      documentRules: {
        supporting_document: {
          allowedExtensions: ["pdf", "png"],
          allowedMimeTypes: ["application/pdf", "image/png"],
          validateContent: "document",
        },
      },
    });
    const staged = new StorageStagedUploadService(prisma, objects, policy);
    const access = new WarehouseStockAdjustmentAccessService();
    const queries = new WarehouseStockAdjustmentQueryService(prisma, access);
    const documents = new WarehouseStockAdjustmentDocumentService(
      prisma,
      staged,
      access,
    );
    const adjustments = new WarehouseStockAdjustmentsService(
      new WarehouseStockAdjustmentCommandService(
        prisma,
        stock,
        staged,
        audit,
        access,
      ),
      queries,
      documents,
    );
    const file = {
      buffer: Buffer.from("%PDF-1.4\nDocument\n%%EOF"),
      originalname: "basis.pdf",
      mimetype: "application/pdf",
      size: 30,
    };
    const upload = async (actor = admin.id) =>
      (await adjustments.uploadDocument(file, actor)).uploadId;
    const request = async (extra = {}, actor = admin.id) => ({
      itemId: item.id.toString(),
      locationId: location.id.toString(),
      requestKey: randomUUID(),
      type: "WRITE_OFF",
      quantity: "4",
      reason: "Inventory shortage",
      attachments: [await upload(actor)],
      ...extra,
    });
    const quantity = async () =>
      (await stock.getBalance(item.id.toString(), location.id.toString()))
        ?.quantity;
    const initial = await prisma.$transaction((tx) =>
      stock.receiveStock(
        { tx, actorUserId: admin.id },
        item.id.toString(),
        location.id.toString(),
        initialQuantity,
      ),
    );
    const projectRow = await prisma.warehouseProject.create({
      data: { projectNumber: "ADJUST-PROJECT" },
    });
    const reservation = await prisma.warehouseProjectReservation.create({
      data: {
        balanceId: BigInt(initial.id),
        projectId: projectRow.id,
        quantity: "18",
      },
    });

    await testCase({
      prisma,
      url,
      admin,
      keeper,
      secondAdmin,
      item,
      location,
      audit,
      stock,
      policy,
      staged,
      access,
      queries,
      documents,
      adjustments,
      file,
      upload,
      request,
      quantity,
      reservation,
      storage,
      objects,
    });
  } finally {
    await prisma.$disconnect();
  }
}
