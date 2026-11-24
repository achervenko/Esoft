import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createReservationFixture } from "../warehouse-reservation-fixture.mjs";
import { receiptsImportMapping } from "./receipts-import-mapping.mjs";
import { receiptsImportVersions } from "./receipts-import-versions.mjs";
import { receiptsImportCancellation } from "./receipts-import-cancellation.mjs";
import { receiptsImportReconciliation } from "./receipts-import-reconciliation.mjs";
import { receiptsImportQueries } from "./receipts-import-queries.mjs";
import { receiptsImportRaces } from "./receipts-import-races.mjs";

export async function receiptsImport(c, t) {
  await receiptsImportMapping(c, t);
  await receiptsImportVersions(c, t);
  await receiptsImportCancellation(c, t);
  await receiptsImportReconciliation(c, t);
  await receiptsImportQueries(c, t);
  await receiptsImportRaces(c, t);
  await t.test(
    "versioned import and snapshot import serialize on the same receipt",
    async () => {
      const source = c.source();
      const [versioned, snapshot] = await Promise.all([
        c.ingest(source),
        c.prisma.$transaction((tx) =>
          c.importer.applySnapshot(tx, c.sourceSystem, source, c.admin.id),
        ),
      ]);
      assert.equal(versioned.id, snapshot.id);
      assert.equal(versioned.sourceVersion, "1");
      assert.equal(snapshot.sourceVersion, "1");
      assert.equal(
        await c.prisma.warehouseReceipt.count({
          where: { source: "ONE_C", sourceOperationId: source.id },
        }),
        1,
      );
    },
  );
  await t.test(
    "closed orders notify while any positive reservation remains",
    async () => {
      const load = (file) =>
        createRequire(import.meta.url)("../../../../backend/dist/src/" + file);
      const { CLOSED_ORDER_STATUS } = load("orders/orders.constants.js");
      const { WarehouseReservationManager } = load(
        "warehouse/reservations/reservation-manager.service.js",
      );
      const manager = new WarehouseReservationManager(
        c.audit,
        c.stock,
        c.warehouseNotifications,
      );
      const transaction = (fn) =>
        c.prisma.$transaction((tx) => fn({ tx, actorUserId: c.admin.id }));
      const f = await createReservationFixture({
        ...c,
        actor: c.admin,
        id: String(c.item.id),
        loc: String,
        transaction,
      });
      const manual = await c.manual("3");
      await c.place(manual, "3");
      const reserve = await transaction((ctx) =>
        manager.reserve(ctx, f.input(c.location.id, "2")),
      );
      const key = `warehouse.order.reserved:${f.first.id}`;
      const history = () =>
        c.prisma.notification.findMany({ where: { actionKey: key } });
      const setStatus = (status) =>
        transaction(async ({ tx }) => {
          await tx.customerOrder.update({
            where: { id: f.first.id },
            data: { status },
          });
          await c.warehouseNotifications.order(tx, f.first.id);
        });
      assert.equal((await history()).length, 0);
      await setStatus(CLOSED_ORDER_STATUS);
      assert.equal(
        (await history()).filter((row) => !row.resolvedAt).length,
        1,
      );
      await setStatus(f.first.status);
      assert.ok((await history())[0].resolvedAt);
      await setStatus(CLOSED_ORDER_STATUS);
      const sync = () =>
        transaction(({ tx }) => c.warehouseNotifications.order(tx, f.first.id));
      await Promise.all([sync(), sync()]);
      assert.equal((await history()).length, 2);
      const active = (await history()).find((row) => !row.resolvedAt);
      const unread = async () =>
        (
          await c.notifications.list(c.admin.id, { filter: "unread" })
        ).items.some(({ id }) => id === active.id);
      assert.equal(await unread(), true);
      await transaction((ctx) =>
        manager.decrease(ctx, {
          reservationId: reserve.reservation.id,
          allocations: [{ locationId: String(c.location.id), quantity: "2" }],
          deficitQuantity: "0",
        }),
      );
      assert.ok((await history()).every((row) => row.resolvedAt));
      assert.equal(await unread(), false);
    },
  );
  await t.test(
    "receipt action survives reading and closes on first placement",
    async () => {
      const observer = await c.prisma.user.create({
        data: {
          id: `${c.namespace}-notification-observer`,
          name: "Observer",
          email: `${c.namespace}-observer@test.invalid`,
          role: "operator",
        },
      });
      const source = c.source();
      const receipt = await c.mapped(source);
      const targetPath = `#/warehouse/receipts/${receipt.id}`;
      const list = async (filter = "all") =>
        (await c.notifications.list(c.keeper.id, { filter })).items.filter(
          (item) => item.targetPath === targetPath,
        );
      await Promise.all([c.ingest(source), c.ingest(source)]);
      const [message] = await list("unread");
      assert.equal((await list()).length, 1);
      assert.equal(message.title, "Новый приход из 1С");
      assert.equal(
        await c.prisma.notificationRecipient.count({
          where: { notificationId: message.id, userId: observer.id },
        }),
        0,
      );
      assert.equal(message.readAt, null);
      await c.receipts.findOne(receipt.id);
      await c.notifications.markRead(c.keeper.id, message.id);
      assert.equal((await list("unread")).length, 0);
      assert.equal((await list())[0].resolvedAt, null);
      await c.place(receipt, "1");
      assert.equal((await c.receipts.findOne(receipt.id)).status, "PLACING");
      assert.equal((await list("unread")).length, 0);
      assert.ok((await list())[0].resolvedAt);

      await c.ingest({ ...source, version: "2", status: "CANCELLED" });
      const [conflict] = await list("unread");
      const adminHasConflict = async () =>
        (
          await c.notifications.list(c.admin.id, { filter: "unread" })
        ).items.some(({ id }) => id === conflict.id);
      assert.equal(await adminHasConflict(), true);
      assert.equal(conflict.type, "warehouse.receipt.conflict");
      await c.conflictResolution.resolve(
        receipt.id,
        {
          action: "KEEP_CURRENT",
          reason: "Проверка",
          sourceVersion: "2",
        },
        c.keeper.id,
      );
      assert.equal((await list("unread")).length, 0);
      assert.equal(await adminHasConflict(), false);
      assert.equal(
        (await list()).find(({ id }) => id === conflict.id).readAt,
        null,
      );
      await c.ingest({ ...source, version: "3", status: "CANCELLED" });
      assert.notEqual((await list("unread"))[0].id, conflict.id);
      await c.ingest({ ...source, version: "4" });
      assert.equal((await list("unread")).length, 0);
      assert.equal((await list()).length, 3);
    },
  );
  await t.test(
    "import rollback leaves neither a receipt nor a notification",
    async () => {
      const doc = c.source();
      let receiptId;
      await assert.rejects(
        c.prisma.$transaction(async (tx) => {
          const receipt = await c.importer.apply(
            tx,
            c.sourceSystem,
            doc,
            c.admin.id,
          );
          receiptId = receipt.id;
          assert.ok(
            await tx.notification.findFirst({
              where: { actionKey: `warehouse.receipt.created:${receiptId}` },
            }),
          );
          throw Error("caller rollback");
        }),
        /caller rollback/,
      );
      assert.equal(
        await c.prisma.warehouseReceipt.count({
          where: { id: BigInt(receiptId) },
        }),
        0,
      );
      assert.equal(
        await c.prisma.notification.count({
          where: { actionKey: `warehouse.receipt.created:${receiptId}` },
        }),
        0,
      );
    },
  );
  await t.test(
    "receipt action closes on one-step completion or cancellation",
    async () => {
      for (const cancel of [false, true]) {
        const doc = c.source();
        const receipt = await c.mapped(doc);
        const key = `warehouse.receipt.created:${receipt.id}`;
        const find = () =>
          c.prisma.notification.findFirstOrThrow({ where: { actionKey: key } });
        assert.equal((await find()).resolvedAt, null);
        if (cancel)
          await c.ingest({ ...doc, version: "2", status: "CANCELLED" });
        else await c.place(receipt, "10");
        assert.ok((await find()).resolvedAt);
      }
    },
  );
}
