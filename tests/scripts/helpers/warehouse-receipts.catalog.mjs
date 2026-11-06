import assert from "node:assert/strict";
import { code } from "./warehouse-receipts-test-context.mjs";
export async function receiptsCatalogBoundary(c, t) {
  await t.test(
    "pending receipts protect units without any balance or issue sheet",
    async () => {
      const item = await c.catalog.create(
        { article: c.namespace + "-pending-unit", name: "Pending", unit: "шт" },
        c.keeper.id,
      );
      const receipt = await c.manual("1", {
        lines: [{ itemId: item.id, quantity: "1" }],
      });
      assert.equal(
        await c.prisma.warehouseBalance.count({
          where: { itemId: BigInt(item.id) },
        }),
        0,
      );
      assert.equal(
        await c.prisma.warehouseIssueSheetLine.count({
          where: { itemId: BigInt(item.id) },
        }),
        0,
      );
      await assert.rejects(
        c.catalog.update(item.id, { unit: "м" }, c.keeper.id),
        code("WAREHOUSE_UNIT_IN_USE"),
      );
      await c.receipts.cancelManual(receipt.id, c.keeper.id);
      assert.equal(
        (await c.catalog.update(item.id, { unit: "м" }, c.keeper.id)).unit,
        "м",
      );
    },
  );
  await t.test(
    "unit change versus a first receipt uses one consistent unit",
    async () => {
      const item = await c.catalog.create(
        { article: c.namespace + "-unit-race", name: "Race", unit: "шт" },
        c.keeper.id,
      );
      const race = await Promise.allSettled([
        c.manual("1", { lines: [{ itemId: item.id, quantity: "1" }] }),
        c.catalog.update(item.id, { unit: "м" }, c.keeper.id),
      ]);
      assert.equal(race[0].status, "fulfilled");
      const current = await c.catalog.findOne(item.id);
      assert.equal(race[0].value.lines[0].unit, current.unit);
      if (race[1].status === "rejected")
        assert.equal(race[1].reason.response.code, "WAREHOUSE_UNIT_IN_USE");
    },
  );
  await t.test(
    "Catalog binds external identities without a receipt and preserves source spelling",
    async () => {
      const data = {
        sourceSystem: c.namespace + "-catalog-only",
        externalId: "external",
        itemId: String(c.item.id),
        sourceArticle: " A–А ",
        sourceName: " Source name ",
      };
      const bind = () =>
        c.prisma.$transaction((tx) => c.links.bind(tx, data, c.keeper.id));
      assert.equal((await bind()).itemId, String(c.item.id));
      assert.equal((await bind()).itemId, String(c.item.id));
      const stored = await c.prisma.warehouseItemExternalLink.findUnique({
        where: {
          sourceSystem_externalId: {
            sourceSystem: data.sourceSystem,
            externalId: data.externalId,
          },
        },
      });
      assert.equal(stored.sourceArticle, " A–А ");
      const other = await c.catalog.create(
        { article: c.namespace + "-other-link", name: "Other", unit: "шт" },
        c.keeper.id,
      );
      await assert.rejects(
        c.prisma.$transaction((tx) =>
          c.links.bind(tx, { ...data, itemId: other.id }, c.keeper.id),
        ),
        code("WAREHOUSE_CATALOG_LINK_CONFLICT"),
      );
    },
  );
  await t.test(
    "operation reads expose only the stable summary and roll back links with their caller",
    async () => {
      const [summary] = await c.prisma.$transaction((tx) =>
        c.catalog.lockItemsForOperation([String(c.item.id)], tx),
      );
      assert.deepEqual(
        Object.keys(summary).sort(),
        ["id", "article", "name", "unit", "isActive"].sort(),
      );
      const data = {
        sourceSystem: c.namespace + "-rollback-link",
        externalId: "external",
        itemId: String(c.item.id),
        sourceArticle: "A",
        sourceName: "Source",
      };
      await assert.rejects(
        c.prisma.$transaction(async (tx) => {
          await c.links.bind(tx, data, c.keeper.id);
          throw Error("caller failed");
        }),
        /caller failed/,
      );
      assert.equal(
        await c.prisma.warehouseItemExternalLink.count({
          where: {
            sourceSystem: data.sourceSystem,
            externalId: data.externalId,
          },
        }),
        0,
      );
    },
  );
}
