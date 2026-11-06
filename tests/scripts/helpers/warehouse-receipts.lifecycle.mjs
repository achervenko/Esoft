import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { createWarehouseIssuesTestContext } from "./warehouse-issues-test-context.mjs";
const require = createRequire(import.meta.url);
const load = (path) => require("../../../backend/dist/src/" + path);

export async function receiptsLifecycle(c, t) {
  await t.test(
    "one real warehouse lifecycle: import, placement, reservation, transfers, issues, reconciliation and historical replay",
    async () => {
      const issues = await createWarehouseIssuesTestContext(c.prisma);
      c.audit.writeFieldChanges = issues.audit.writeFieldChanges.bind(
        issues.audit,
      );
      const { WarehouseTransfersService } = load(
        "warehouse/transfers/transfers.service.js",
      );
      const { WarehouseReservationsApiService } = load(
        "warehouse/reservations/reservations-api.service.js",
      );
      const { WarehouseStockOverviewService } = load(
        "warehouse/stock/stock-overview.service.js",
      );
      const overview = new WarehouseStockOverviewService(c.prisma);
      const transfers = new WarehouseTransfersService(
        c.prisma,
        issues.stock,
        issues.reservations,
        issues.audit,
      );
      const reservations = new WarehouseReservationsApiService(
        c.prisma,
        issues.stock,
        issues.reservations,
        issues.audit,
      );
      const itemId = String(c.item.id);
      const projectId = String(issues.projects[0].id);
      const sourceDocument = c.source();
      const receipt = await c.mapped(sourceDocument);
      assert.equal(await c.quantity(), "0");
      const firstKey = randomUUID();
      await c.place(receipt, "6", c.location.id, firstKey);
      await c.place(receipt, "4", c.target.id);
      assert.equal(await c.quantity(), "10");
      const balance = (location) =>
        c.prisma.warehouseBalance.findUniqueOrThrow({
          where: {
            itemId_storageLocationId: {
              itemId: c.item.id,
              storageLocationId: location.id,
            },
          },
        });
      const from = await balance(c.location),
        to = await balance(c.target);
      await reservations.create(
        { balanceId: String(from.id), projectId, quantity: "4" },
        c.keeper.id,
      );
      const transfer = (quantity, extra = {}) => ({
        requestKey: randomUUID(),
        itemId,
        fromLocationId: String(c.location.id),
        toLocationId: String(c.target.id),
        quantity,
        ...extra,
      });
      await transfers.create(transfer("2"), c.keeper.id);
      assert.equal((await balance(c.location)).quantity.toString(), "4");
      assert.equal((await balance(c.target)).quantity.toString(), "6");
      await assert.rejects(
        transfers.create(transfer("1"), c.keeper.id),
        (error) => error.response.code === "WAREHOUSE_TRANSFER_RESERVED_STOCK",
      );
      const reservedMove = transfer("2", { moveReservation: true, projectId });
      const moved = await transfers.create(reservedMove, c.keeper.id);
      assert.equal(
        (await transfers.create(reservedMove, c.keeper.id)).id,
        moved.id,
      );
      assert.equal(await c.quantity(), "10");
      const issuePayload = {
        requestKey: randomUUID(),
        type: "MANUAL",
        projectId,
        positions: [{ balanceId: String(to.id), quantity: "2" }],
      };
      const issued = await issues.service.createIssue(
        issuePayload,
        c.keeper.id,
      );
      assert.equal(issued.reservationUsage[0].quantity, "2");
      assert.equal(
        await issues.reserveQuantity(to.id, issues.projects[0].id),
        "0",
      );
      assert.equal(
        await issues.reserveQuantity(from.id, issues.projects[0].id),
        "2",
      );
      assert.equal(await c.quantity(), "8");
      assert.equal(
        (await issues.service.createIssue(issuePayload, c.keeper.id)).id,
        issued.id,
      );
      await issues.service.createIssue(
        {
          requestKey: randomUUID(),
          type: "MANUAL",
          positions: [{ balanceId: String(to.id), quantity: "3" }],
        },
        c.keeper.id,
      );
      assert.equal(await c.quantity(), "5");
      await c.ingest(sourceDocument);
      await c.place(receipt, "6", c.location.id, firstKey);
      assert.equal(
        await c.quantity(),
        "5",
        "replay must not restore already issued stock",
      );
      assert.equal(
        (await c.receipts.findOne(receipt.id)).lines[0].placed,
        "10",
      );
      const manual = await c.manual("3", {
        documentNumber: "LIFECYCLE-MANUAL",
        documentDate: "2026-10-29",
      });
      await c.place(manual, "3");
      const imported = await c.mapped(
        c.source({
          number: "LIFECYCLE-MANUAL",
          lines: [{ ...sourceDocument.lines[0], quantity: "3" }],
        }),
      );
      assert.ok(
        (await c.queries.reconciliationCandidates(imported.id)).items.some(
          (row) => row.id === manual.id,
        ),
      );
      const link = {
        manualReceiptId: manual.id,
        lines: [
          {
            manualLineId: manual.lines[0].id,
            receiptLineId: imported.lines[0].id,
          },
        ],
      };
      await c.reconciliation.reconcile(imported.id, link, c.keeper.id);
      await c.reconciliation.reconcile(imported.id, link, c.keeper.id);
      assert.equal(await c.quantity(), "8");
      assert.equal(
        await issues.stock.getItemTotal(itemId, String(c.warehouse.id)),
        "8",
      );
      const available = await issues.queries.available({ itemId });
      assert.equal(
        available.items.reduce((sum, row) => sum + Number(row.physical), 0),
        8,
      );
      assert.equal(
        available.items.reduce((sum, row) => sum + Number(row.available), 0),
        6,
      );
      const distribution = await overview.distribution(
        itemId,
        String(c.warehouse.id),
      );
      assert.equal(distribution.totalQuantity, "8");
      assert.equal(
        distribution.locations.reduce(
          (sum, row) => sum + Number(row.available),
          0,
        ),
        6,
      );
      const page = await overview.list({
        warehouseId: String(c.warehouse.id),
        search: c.item.article,
      });
      assert.equal(page.total, 1);
      assert.equal(page.items[0].quantity, "8");
      assert.equal((await c.receipts.findOne(imported.id)).status, "PLACED");
      assert.ok(
        (await c.prisma.auditLog.count({ where: { userId: c.keeper.id } })) > 0,
      );
    },
  );
}
