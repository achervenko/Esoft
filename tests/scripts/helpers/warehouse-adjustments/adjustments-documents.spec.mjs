import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { code, load } from "./adjustments-test-context.mjs";

export async function verify(run) {
  const { ADJUSTMENT_OWNER } = load(
    "warehouse/adjustments/adjustments.constants.js",
  );
  const { StorageFileService } = load("storage/storage-file.service.js");
  const { StorageOwnerLockService } = load(
    "storage/storage-owner-lock.service.js",
  );
  const { StorageOwnerService } = load("storage/storage-owner.service.js");
  const { StorageFilePrimaryService } = load(
    "storage/storage-file-primary.service.js",
  );
  await run(
    "documents are required, scoped to their author and operation, and cannot be reused",
    async ({
      prisma,
      admin,
      secondAdmin,
      staged,
      adjustments,
      file,
      upload,
      request,
    }) => {
      const stagedBefore = await prisma.storageUpload.count();
      await assert.rejects(
        adjustments.uploadDocument(
          { ...file, buffer: Buffer.from("not a pdf") },
          admin.id,
        ),
        code("INVALID_PDF"),
      );
      assert.equal(await prisma.storageUpload.count(), stagedBefore);
      const payload = await request();
      await assert.rejects(
        adjustments.adjustStock({ ...payload, attachments: [] }, admin.id),
        code("WAREHOUSE_ADJUSTMENT_INVALID"),
      );
      await assert.rejects(
        adjustments.adjustStock(payload, secondAdmin.id),
        code("STORAGE_UPLOAD_UNAVAILABLE"),
      );
      const foreign = await staged.prepare(
        { module: "another", entityType: "document" },
        admin.id,
        "supporting_document",
        file,
      );
      await assert.rejects(
        adjustments.adjustStock(
          { ...payload, attachments: [foreign.uploadId] },
          admin.id,
        ),
        code("STORAGE_UPLOAD_UNAVAILABLE"),
      );
      const used = await adjustments.adjustStock(
        { ...payload, type: "SURPLUS", quantity: "1" },
        admin.id,
      );
      await assert.rejects(
        adjustments.adjustStock(
          { ...payload, requestKey: randomUUID() },
          admin.id,
        ),
        code("STORAGE_UPLOAD_UNAVAILABLE"),
      );
      assert.equal(used.adjustment.attachments.length, 1);
      const expired = await upload();
      await prisma.storageUpload.update({
        where: { id: expired },
        data: { expiresAt: new Date(0) },
      });
      await assert.rejects(
        adjustments.adjustStock(
          {
            ...payload,
            requestKey: randomUUID(),
            attachments: [expired],
          },
          admin.id,
        ),
        code("STORAGE_UPLOAD_UNAVAILABLE"),
      );
    },
  );
  await run(
    "posted documents are immutable and downloads remain owner-bound",
    async ({ prisma, admin, audit, policy, objects, adjustments, request }) => {
      const { adjustment: created } = await adjustments.adjustStock(
        await request(),
        admin.id,
      );
      const operation = await prisma.warehouseStockAdjustment.findUniqueOrThrow(
        {
          where: { id: BigInt(created.id) },
          include: { attachments: true },
        },
      );
      const fileId = operation.attachments[0].fileId;
      const owner = {
        ...ADJUSTMENT_OWNER,
        entityId: operation.id.toString(),
      };
      const files = new StorageFileService(
        audit,
        objects,
        new StorageOwnerLockService(),
        new StorageOwnerService(prisma),
        {},
        {},
        prisma,
        {},
      );
      assert.equal(
        (await files.getDownload({ fileId, owner })).contentType,
        "application/pdf",
      );
      await assert.rejects(
        files.getDownload({
          fileId,
          owner: { ...owner, entityId: "another-id" },
        }),
        /Файл не найден/,
      );
      await assert.rejects(
        files.softDeleteFile({
          fileId,
          owner,
          userId: admin.id,
          audit: { actionModule: "WAREHOUSE" },
        }),
        code("STORAGE_FILE_IMMUTABLE"),
      );
      const primary = new StorageFilePrimaryService(
        audit,
        new StorageOwnerLockService(),
        policy,
        prisma,
      );
      await assert.rejects(
        primary.setPrimaryFile({
          fileId,
          owner,
          userId: admin.id,
          audit: { actionModule: "WAREHOUSE" },
        }),
        code("STORAGE_FILE_IMMUTABLE"),
      );
      assert.equal(
        (
          await prisma.storageFile.findUniqueOrThrow({
            where: { id: fileId },
          })
        ).deletedAt,
        null,
      );
    },
  );
}
