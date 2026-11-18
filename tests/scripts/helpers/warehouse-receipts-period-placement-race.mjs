import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { code } from "./warehouse-receipts-test-context.mjs";
import { waitForAdvisoryLock } from "./warehouse-receipts-period-locks.mjs";

async function raceInvoiceUpdate(c, place, update, whilePaused) {
  const checked = Promise.withResolvers();
  const resume = Promise.withResolvers();
  const gated = Object.create(c.placements);
  gated.prisma = {
    $transaction: async (work, options) => {
      await c.prisma.$transaction(async (tx) => {
        const queryRaw = async (sql, ...args) => {
          const result = await tx.$queryRaw(sql, ...args);
          if (sql.join("").includes("AS available")) {
            const [row] = await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
            checked.resolve(row.pid);
            await resume.promise;
          }
          return result;
        };
        return work(
          new Proxy(
            {},
            {
              get: (_target, key) => (key === "$queryRaw" ? queryRaw : tx[key]),
            },
          ),
        );
      }, options);
      throw new Error("Lost placement COMMIT acknowledgement");
    },
  };
  const placement = assert.rejects(place(gated), /Lost placement COMMIT/);
  const holder = await Promise.race([
    checked.promise,
    placement.then(() => assert.fail("Placement did not reach the gate")),
  ]);
  const importing = update();
  try {
    await waitForAdvisoryLock(c.prisma, holder);
    await whilePaused();
  } finally {
    resume.resolve();
    await Promise.all([placement, importing]);
  }
}

export async function verifyReceiptPeriodPlacementRace(
  c,
  t,
  fixture,
  linkedOrder,
) {
  const { a, invoice, payload, run, warehouses } = fixture;
  await t.test(
    "placement serializes invoice changes and replays a lost acknowledgement",
    async () => {
      const makeInvoice = () => ({
        ...invoice,
        id: randomUUID(),
        status: "POSTED",
        lines: [
          {
            ...invoice.lines[0],
            warehouse_id: warehouses[0],
            quantity: 1,
          },
        ],
      });
      const findReceipt = (id) =>
        c.prisma.warehouseReceipt.findFirstOrThrow({
          where: { sourceOperationId: `invoice:${id}:${warehouses[0]}` },
          include: { lines: true },
        });
      for (const change of ["cancel", "remove line"]) {
        const racing = makeInvoice();
        const independent = makeInvoice();
        payload.extra = [racing, independent];
        payload.total = 3;
        await run(a);
        const receipt = await findReceipt(racing.id);
        const other = await findReceipt(independent.id);
        const input = c.placement();
        const placeRace = (service = c.placements, payload = input) =>
          service.place(
            String(receipt.id),
            String(receipt.lines[0].id),
            payload,
            c.keeper.id,
          );
        const before = Number(await c.quantity());
        const reserved = async () =>
          Number(
            (
              await c.prisma.warehouseReservation.findUniqueOrThrow({
                where: {
                  orderId_itemId: {
                    orderId: linkedOrder.id,
                    itemId: c.item.id,
                  },
                },
              })
            ).quantity,
          );
        const reservedBefore = await reserved();
        await raceInvoiceUpdate(
          c,
          placeRace,
          () => {
            if (change === "cancel") racing.status = "CANCELED";
            else
              racing.lines = [
                { ...racing.lines[0], warehouse_id: warehouses[1] },
              ];
            return run(a);
          },
          async () => {
            const placeOther = () =>
              c.placements.place(
                String(other.id),
                String(other.lines[0].id),
                c.placement(),
                c.keeper.id,
              );
            const results = await Promise.allSettled([
              placeOther(),
              placeOther(),
            ]);
            assert.equal(
              results.filter(({ status }) => status === "fulfilled").length,
              1,
            );
            code("WAREHOUSE_RECEIPT_OVERPLACEMENT")(
              results.find(({ status }) => status === "rejected").reason,
            );
          },
        );
        assert.equal(
          (await findReceipt(racing.id)).conflict,
          change === "cancel"
            ? "SOURCE_CANCELLED_AFTER_PLACEMENT"
            : "SOURCE_LINES_CHANGED_AFTER_PLACEMENT",
        );
        await placeRace();
        await assert.rejects(
          placeRace(c.placements, c.placement()),
          code("WAREHOUSE_RECEIPT_BLOCKED"),
        );
        assert.equal(Number(await c.quantity()), before + 2);
        assert.equal(await reserved(), reservedBefore + 2);

        independent.status = "CANCELED";
        await run(a);
        await assert.rejects(
          c.placements.place(
            String(other.id),
            String(other.lines[0].id),
            c.placement(),
            c.keeper.id,
          ),
          code("WAREHOUSE_RECEIPT_BLOCKED"),
        );
      }
    },
  );
}
