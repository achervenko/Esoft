import assert from "node:assert/strict";
import { code } from "./adjustments-test-context.mjs";

export async function verify(run) {
  await run(
    "only admin may upload, create or read; revoked and banned admins are rejected",
    async ({ prisma, keeper, secondAdmin, adjustments, file, request }) => {
      await assert.rejects(
        adjustments.uploadDocument(file, keeper.id),
        code("FORBIDDEN"),
      );
      const payload = await request();
      await assert.rejects(
        adjustments.adjustStock(payload, keeper.id),
        code("FORBIDDEN"),
      );
      await assert.rejects(adjustments.get("1", keeper.id), code("FORBIDDEN"));
      await assert.rejects(adjustments.list({}, keeper.id), code("FORBIDDEN"));
      await prisma.user.update({
        where: { id: secondAdmin.id },
        data: { banned: true },
      });
      await assert.rejects(
        adjustments.uploadDocument(file, secondAdmin.id),
        code("FORBIDDEN"),
      );
      await prisma.user.update({
        where: { id: secondAdmin.id },
        data: { banned: false, role: "storekeeper" },
      });
      await assert.rejects(
        adjustments.adjustStock(payload, secondAdmin.id),
        code("FORBIDDEN"),
      );
      await prisma.user.update({
        where: { id: secondAdmin.id },
        data: { role: "admin" },
      });
    },
  );
}
