import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function adversarialReceiptModel(c, t) {
  for (const initialSeed of [
    0x30c71026, 0xabcdef12, 0x12345678, 0xdeadbeef, 0x87654321, 0x10203040,
    0x55555555, 0x7fffffff, 0x31415926, 0x27182818,
  ])
    await t.test(
      `seed ${initialSeed}: 240 placements/replays/invalid requests with independent integer oracle`,
      async () => {
        let seed = initialSeed;
        const unrelatedQuantity = await c.quantity();
        const random = (max) => {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          return seed % max;
        };
        const decimal = (units) =>
          `${Math.floor(units / 1000)}.${String(units % 1000).padStart(3, "0")}`;
        const item = await c.prisma.warehouseItem.create({
          data: {
            article: c.namespace + "-oracle-" + initialSeed,
            name: "Independent oracle",
            unit: "м",
          },
        });
        const receipts = [];
        for (let index = 0; index < 12; index++) {
          const expected = 10_000 + random(50_000);
          const receipt = await c.manual(decimal(expected), {
            lines: [{ itemId: String(item.id), quantity: decimal(expected) }],
          });
          receipts.push({ receipt, expected, placed: 0, requests: [] });
        }
        let physical = 0,
          successes = 0,
          replays = 0,
          refusals = 0;
        for (let step = 0; step < 240; step++) {
          const row = receipts[random(receipts.length)],
            choice = random(5);
          let quantity = 1 + random(10_000);
          const payload = {
            requestKey: randomUUID(),
            storageLocationId: String(random(2) ? c.location.id : c.target.id),
            quantity: decimal(quantity),
          };
          if (choice === 0 && row.requests.length) {
            const previous = row.requests[random(row.requests.length)];
            await c.placements.place(
              row.receipt.id,
              row.receipt.lines[0].id,
              previous,
              c.keeper.id,
            );
            replays++;
          } else if (choice === 1) {
            payload.quantity = ["-1", "0", "0.0001", "NaN", "1e3"][random(5)];
            await assert.rejects(
              async () =>
                c.placements.place(
                  row.receipt.id,
                  row.receipt.lines[0].id,
                  payload,
                  c.keeper.id,
                ),
              (error) => {
                assert.equal(
                  error.response?.code,
                  "WAREHOUSE_STOCK_QUANTITY_INVALID",
                );
                return true;
              },
            );
            refusals++;
          } else if (row.placed + quantity > row.expected) {
            await assert.rejects(
              c.placements.place(
                row.receipt.id,
                row.receipt.lines[0].id,
                payload,
                c.keeper.id,
              ),
              (error) => {
                assert.equal(
                  error.response?.code,
                  "WAREHOUSE_RECEIPT_OVERPLACEMENT",
                );
                return true;
              },
            );
            refusals++;
          } else {
            await c.placements.place(
              row.receipt.id,
              row.receipt.lines[0].id,
              payload,
              c.keeper.id,
            );
            row.placed += quantity;
            physical += quantity;
            successes++;
            row.requests.push(payload);
          }
          const actual = await c.prisma.warehouseBalance.aggregate({
            where: { itemId: item.id },
            _sum: { quantity: true },
          });
          assert.equal(
            actual._sum.quantity?.mul(1000).toNumber() ?? 0,
            physical,
            `independent physical oracle, step ${step}`,
          );
          const view = await c.receipts.findOne(row.receipt.id);
          const [whole, fraction = ""] = view.lines[0].placed.split(".");
          assert.equal(
            Number(whole) * 1000 + Number(fraction.padEnd(3, "0")),
            row.placed,
          );
          assert.equal(
            view.status,
            row.placed === row.expected
              ? "PLACED"
              : row.placed
                ? "PLACING"
                : "RECEIVED",
          );
        }
        c.trace("assertion", {
          name: "independent seeded stock oracle",
          seed: initialSeed,
          steps: 240,
          successes,
          replays,
          refusals,
          finalPhysicalThousandths: physical,
        });
        assert.equal(await c.quantity(), unrelatedQuantity);
      },
    );
  await t.test(
    "100-line manual receipt and source document remain stock-neutral until placement",
    async () => {
      const lines = Array.from({ length: 100 }, () => ({
        itemId: String(c.item.id),
        quantity: "0.001",
      }));
      const before = await c.quantity();
      const receipt = await c.manual("0.001", { lines });
      assert.equal(receipt.lines.length, 100);
      assert.equal(await c.quantity(), before);
      const source = c.source();
      source.lines = Array.from({ length: 100 }, (_, index) => ({
        ...source.lines[0],
        id: `mass-${index}`,
      }));
      const imported = await c.ingest(source);
      assert.equal(imported.lines.length, 100);
      assert.equal(await c.quantity(), before);
    },
  );
}
