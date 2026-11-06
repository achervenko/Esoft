import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
const { Prisma } = createRequire(import.meta.url)("@prisma/client");

export async function adversarialReceiptResponseLoss(c, http, t) {
  await t.test(
    "three authenticated storekeepers race for the same remainder without overplacement",
    async () => {
      const receipt = (
        await http.request("POST", "receipts", {
          role: "keeper",
          body: {
            warehouseId: String(c.warehouse.id),
            requestKey: randomUUID(),
            lines: [{ itemId: String(c.item.id), quantity: "10" }],
          },
          expected: 201,
        })
      ).body;
      const stockBefore = await c.quantity();
      const path = `receipts/${receipt.id}/lines/${receipt.lines[0].id}/placements`;
      const replies = await Promise.all(
        ["keeper", "keeper2", "keeper3"].map((role) =>
          http.request("POST", path, {
            role,
            body: {
              requestKey: randomUUID(),
              storageLocationId: String(c.location.id),
              quantity: "4",
            },
          }),
        ),
      );
      assert.equal(replies.filter((r) => r.status === 201).length, 2);
      const rejected = replies.filter((r) => r.status !== 201);
      assert.equal(rejected.length, 1);
      assert.equal(rejected[0].status, 409);
      assert.equal(rejected[0].body.code, "WAREHOUSE_RECEIPT_OVERPLACEMENT");
      assert.equal(
        new Prisma.Decimal(await c.quantity()).minus(stockBefore).toFixed(3),
        "8.000",
      );
      const view = (
        await http.request("GET", `receipts/${receipt.id}`, {
          role: "keeper3",
          expected: 200,
        })
      ).body;
      assert.equal(view.lines[0].placed, "8");
      assert.equal(view.lines[0].remaining, "2");
      assert.equal(view.lines[0].placements.length, 2);
    },
  );
  await t.test(
    "a proxy drops committed create/placement responses; HTTP retries never duplicate stock",
    async () => {
      let call;
      const proxy = createServer(async (_request, response) => {
        try {
          await call();
          response.destroy();
        } catch (error) {
          response.writeHead(500).end(String(error));
        }
      });
      await new Promise((resolve) => proxy.listen(0, "127.0.0.1", resolve));
      const address = `http://127.0.0.1:${proxy.address().port}`;
      const body = {
        warehouseId: String(c.warehouse.id),
        requestKey: randomUUID(),
        lines: [{ itemId: String(c.item.id), quantity: "3" }],
      };
      try {
        call = () =>
          http.request("POST", "receipts", {
            role: "keeper",
            body,
            expected: 201,
          });
        const documentsBefore = await c.prisma.warehouseReceipt.count();
        await assert.rejects(fetch(address), /fetch failed/);
        assert.equal(
          await c.prisma.warehouseReceipt.count(),
          documentsBefore + 1,
        );
        const replay = await call();
        const receipt = replay.body;
        assert.equal(
          await c.prisma.warehouseReceipt.count(),
          documentsBefore + 1,
        );
        const placement = {
          requestKey: randomUUID(),
          storageLocationId: String(c.location.id),
          quantity: "1.125",
        };
        const path = `receipts/${receipt.id}/lines/${receipt.lines[0].id}/placements`;
        call = () =>
          http.request("POST", path, {
            role: "keeper",
            body: placement,
            expected: 201,
          });
        const stockBefore = await c.quantity();
        const placementsBefore =
          await c.prisma.warehouseReceiptPlacement.count();
        await assert.rejects(fetch(address), /fetch failed/);
        const replies = await Promise.all(
          Array.from({ length: 12 }, () => call()),
        );
        assert.equal(new Set(replies.map((r) => r.body.id)).size, 1);
        assert.equal(
          await c.prisma.warehouseReceiptPlacement.count(),
          placementsBefore + 1,
        );
        assert.equal(
          new Prisma.Decimal(await c.quantity()).minus(stockBefore).toFixed(3),
          "1.125",
        );
        const current = await http.request("GET", `receipts/${receipt.id}`, {
          role: "keeper",
          expected: 200,
        });
        assert.equal(current.body.lines[0].placed, "1.125");
        assert.equal(current.body.lines[0].remaining, "1.875");
        await http.request("POST", path, {
          role: "keeper",
          body: { ...placement, quantity: "1.126" },
          expected: 409,
        });
        assert.equal(
          new Prisma.Decimal(await c.quantity()).minus(stockBefore).toFixed(3),
          "1.125",
        );
      } finally {
        await new Promise((resolve) => proxy.close(resolve));
      }
    },
  );
}
