import assert from "node:assert/strict";
import { code } from "./adjustments-test-context.mjs";

export async function verify(run) {
  await run(
    "staging survives failures and cleanup retries without deleting attached objects",
    async ({
      prisma,
      admin,
      staged,
      adjustments,
      upload,
      request,
      storage,
    }) => {
      await adjustments.adjustStock(await request(), admin.id);

      storage.failPut = true;
      await assert.rejects(upload(), code("STORAGE_UPLOAD_FAILED"));
      storage.failPut = false;
      const pending = await prisma.storageUpload.findFirstOrThrow({
        where: { uploadedAt: null },
      });
      assert.ok(storage.bytes.has(pending.objectKey));
      storage.failDelete = true;
      await staged.cleanupExpired();
      assert.ok(
        await prisma.storageUpload.findUnique({
          where: { id: pending.id },
        }),
      );
      storage.failDelete = false;
      const filesBefore = await prisma.storageFile.findMany();
      const previousDeletes = storage.deletes;
      await Promise.all([staged.cleanupExpired(), staged.cleanupExpired()]);
      assert.equal(
        await prisma.storageUpload.findUnique({
          where: { id: pending.id },
        }),
        null,
      );
      assert.ok(storage.deletes > previousDeletes);
      for (const saved of filesBefore)
        assert.ok(storage.bytes.has(saved.objectKey));
    },
  );
}
