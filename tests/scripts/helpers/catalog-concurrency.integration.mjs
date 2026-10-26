import assert from "node:assert/strict";
export async function verifyCatalogConcurrency({ prisma, create }) {
  const racing = await Promise.allSettled([
    create("CAT-RACE"),
    create("CAT-RACE"),
  ]);
  assert.equal(
    racing.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.equal(
    racing.find((result) => result.status === "rejected").reason.response.code,
    "WAREHOUSE_ARTICLE_EXISTS",
  );
  assert.equal(
    await prisma.warehouseItem.count({ where: { article: "CAT-RACE" } }),
    1,
  );
}
