import { verifyWarehouseSchemaBasic } from "./warehouse-schema-basic.mjs";
import { verifyWarehouseSchemaConstraints } from "./warehouse-schema-constraints.mjs";
import { verifyWarehouseIssueSheetSchema } from "./warehouse-issue-sheet-schema.mjs";
import { verifyWarehouseSchemaMetadata } from "./warehouse-schema-metadata.mjs";
import { verifyWarehouseIssues } from "./warehouse-issues.mjs";
export async function verifyWarehouseSchema(prisma, database, actor, test) {
  const context = { prisma, database, actor };
  await test.test("basic schema and defaults", async () => {
    Object.assign(context, await verifyWarehouseSchemaBasic(context));
  });
  await test.test("issue sheet schema, snapshots and relations", async () => {
    Object.assign(context, await verifyWarehouseIssueSheetSchema(context));
  });
  await test.test("unique, FK and quantity constraints", () =>
    verifyWarehouseSchemaConstraints(context),
  );
  await test.test("Issues schema", (scenario) =>
    verifyWarehouseIssues(prisma, scenario),
  );
  await test.test("schema metadata and indexes", () =>
    verifyWarehouseSchemaMetadata(context),
  );
}
