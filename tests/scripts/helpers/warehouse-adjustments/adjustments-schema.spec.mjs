import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { load } from "./adjustments-test-context.mjs";

export async function verify(run) {
  await run(
    "database rejects malformed storage owners even through direct SQL",
    async ({ url, admin }) => {
      const client = new Client({ connectionString: url });
      await client.connect();
      try {
        for (const table of ["storage_files", "storage_uploads"]) {
          for (const column of ["owner_module", "owner_entity_type"]) {
            for (const value of ["", "Warehouse", "foo bar", "bad/name"]) {
              const owner = {
                owner_module: "warehouse",
                owner_entity_type: "stock_adjustment",
                [column]: value,
              };
              const extraColumns =
                table === "storage_files" ? "owner_entity_id" : "id, sha256";
              const extraValues =
                table === "storage_files"
                  ? "'125'"
                  : "gen_random_uuid(), repeat('a', 64)";
              await assert.rejects(
                client.query(
                  `INSERT INTO ${table}
                  (bucket, object_key, original_name, mime_type, size_bytes, document_type,
                   owner_module, owner_entity_type, uploaded_by_user_id, ${extraColumns})
                  VALUES ('test', $1, 'test.pdf', 'application/pdf', 1, 'supporting_document', $2, $3, $4, ${extraValues})`,
                  [
                    randomUUID(),
                    owner.owner_module,
                    owner.owner_entity_type,
                    admin.id,
                  ],
                ),
                (error) =>
                  error.code === "23514" &&
                  error.constraint === `chk_${table}_${column}`,
              );
            }
          }
        }
        const { assertStorageOwner } = load(
          "storage/storage-owner.validation.js",
        );
        for (const value of [
          "_internal",
          "1c_receipt",
          "-private",
          "a".repeat(64),
        ]) {
          assert.doesNotThrow(() =>
            assertStorageOwner({
              module: value,
              entityType: value,
              entityId: "125",
            }),
          );
          for (const table of ["storage_files", "storage_uploads"]) {
            const extraColumns =
              table === "storage_files" ? "owner_entity_id" : "id, sha256";
            const extraValues =
              table === "storage_files"
                ? "'125'"
                : "gen_random_uuid(), repeat('a', 64)";
            const result = await client.query(
              `INSERT INTO ${table}
                (bucket, object_key, original_name, mime_type, size_bytes, document_type,
                 owner_module, owner_entity_type, uploaded_by_user_id, ${extraColumns})
                VALUES ('test', $1, 'test.pdf', 'application/pdf', 1, 'supporting_document', $2, $2, $3, ${extraValues}) RETURNING id`,
              [randomUUID(), value, admin.id],
            );
            await client.query(`DELETE FROM ${table} WHERE id = $1`, [
              result.rows[0].id,
            ]);
          }
        }
        for (const value of ["", "x".repeat(129)]) {
          await assert.rejects(
            client.query(
              `INSERT INTO storage_files
              (bucket, object_key, original_name, mime_type, size_bytes, document_type, owner_module, owner_entity_type, owner_entity_id)
              VALUES ('test', $1, 'test.pdf', 'application/pdf', 1, 'supporting_document', 'warehouse', 'stock_adjustment', $2)`,
              [randomUUID(), value],
            ),
            (error) =>
              value
                ? error.code === "22001"
                : error.code === "23514" &&
                  error.constraint === "chk_storage_files_owner_entity_id",
          );
        }
      } finally {
        await client.end();
      }
    },
  );
}
