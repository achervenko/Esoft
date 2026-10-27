import assert from "node:assert/strict";
import { hasCode } from "./warehouse-transfers-test-context.mjs";

export async function verifyTransfersValidation(run) {
  await run(
    "permissions, missing references, inactive warehouses and replay authorization",
    async (ctx) => {
      const {
        prisma,
        actor,
        a,
        b,
        item,
        receive,
        service,
        payload,
        namespace,
      } = ctx;

      const denied = await prisma.user.create({
        data: {
          id: namespace + "-denied",
          email: namespace + "-denied@test.invalid",
          name: "Denied",
          role: "engineer",
        },
      });
      await assert.rejects(
        service.create(payload(), denied.id),
        (e) => e.getStatus() === 403,
      );
      await assert.rejects(
        service.create(
          { ...payload(), itemId: "9223372036854775807" },
          actor.id,
        ),
        hasCode("WAREHOUSE_ITEM_NOT_FOUND", 404),
      );
      await assert.rejects(
        service.create(
          { ...payload(), toLocationId: "9223372036854775807" },
          actor.id,
        ),
        hasCode("WAREHOUSE_LOCATION_NOT_FOUND", 404),
      );
      await assert.rejects(
        service.create(payload(), actor.id),
        hasCode("WAREHOUSE_BALANCE_NOT_FOUND", 404),
      );
      await receive(a, "10");
      await prisma.warehouseItem.update({
        where: { id: item.id },
        data: { isActive: false },
      });
      await assert.rejects(
        service.create(payload(), actor.id),
        hasCode("WAREHOUSE_TRANSFER_INACTIVE_REFERENCE", 409),
      );
      await prisma.warehouseItem.update({
        where: { id: item.id },
        data: { isActive: true },
      });
      await prisma.warehouseStorageLocation.update({
        where: { id: b.id },
        data: { isActive: false },
      });
      await assert.rejects(
        service.create(payload(), actor.id),
        hasCode("WAREHOUSE_TRANSFER_INACTIVE_REFERENCE", 409),
      );
      await prisma.warehouseStorageLocation.update({
        where: { id: b.id },
        data: { isActive: true },
      });
      await prisma.warehouse.update({
        where: { id: a.warehouseId },
        data: { isActive: false },
      });
      await assert.rejects(
        service.create(payload(), actor.id),
        hasCode("WAREHOUSE_INACTIVE", 409),
      );
      await prisma.warehouse.update({
        where: { id: a.warehouseId },
        data: { isActive: true },
      });
      const input = payload();
      await service.create(input, actor.id);
      await prisma.user.update({
        where: { id: actor.id },
        data: { banned: true },
      });
      await assert.rejects(
        service.create(input, actor.id),
        (e) => e.getStatus() === 403,
      );
    },
  );
}
