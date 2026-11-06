import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { code } from "./warehouse-receipts-test-context.mjs";

export async function adversarialReceiptAtomicity(c, http, t) {
  let sourceSystem = c.sourceSystem + "-faults";
  const configuredSource = await c.coreSources.create(
    {
      name: sourceSystem,
      systemType: "ONE_C",
      flows: [
        {
          flowCode: "warehouse.receipts",
          configVersion: 1,
          config: {},
          isActive: true,
        },
      ],
      baseUrl: "http://127.0.0.1:1/",
      authorization: "Bearer outgoing-only",
    },
    c.admin.id,
  );
  sourceSystem = configuredSource.code;
  const sourceId = configuredSource.id;
  const issue = (name) =>
    c.coreKeys.create(
      sourceSystem,
      { flows: { "warehouse.receipts": ["event:create"] }, name },
      c.admin.id,
    );
  for (const fault of ["terminate", "timeout"])
    await t.test(
      `key issuance ${fault}: real PostgreSQL failure cannot commit a credential`,
      async () => {
        const originalCreate = c.machineKeys.create,
          originalAudit = c.audit.writeFieldChanges;
        let candidate;
        c.machineKeys.create = async (...args) => {
          candidate = await originalCreate.apply(c.machineKeys, args);
          return candidate;
        };
        c.audit.writeFieldChanges = async (params) => {
          const [backend] = await params.tx
            .$queryRaw`SELECT pg_backend_pid() AS pid`;
          if (fault === "terminate")
            await c.database.query("SELECT pg_terminate_backend($1)", [
              backend.pid,
            ]);
          else await params.tx.$executeRaw`SELECT pg_sleep(6)`;
          return c.realAudit.writeFieldChanges(params);
        };
        try {
          await assert.rejects(issue("fault-" + fault), (error) => {
            assert.ok(
              ["P1017", "P2028", "P2010"].includes(error.code) ||
                (error.code === "P2039" && error.message.includes("57P01")) ||
                error.message ===
                  "Client has encountered a connection error and is not queryable",
              `${error.code}: ${error.message}`,
            );
            c.trace("assertion", {
              name: "real database fault during issuance",
              fault,
              errorCode: error.code,
            });
            return true;
          });
        } finally {
          c.machineKeys.create = originalCreate;
          c.audit.writeFieldChanges = originalAudit;
        }
        assert.ok(candidate);
        assert.equal(
          await c.prisma.apiKey.findUnique({ where: { id: candidate.id } }),
          null,
        );
        assert.equal(
          await c.prisma.auditLog.count({
            where: { entityStringId: candidate.id },
          }),
          0,
        );
      },
    );
  await t.test(
    "parallel API key verification enforces the configured quota",
    async () => {
      const key = await issue("parallel-quota");
      await c.machineAuth.api.updateApiKey({
        body: {
          configId: "machine",
          keyId: key.id,
          userId: configuredSource.actorUserId,
          rateLimitMax: 3,
        },
      });
      const results = await Promise.allSettled(
        Array.from({ length: 20 }, () =>
          c.machineKeys.verifyBearer(`Bearer ${key.key}`, {
            "warehouse.receipts": ["event:create"],
          }),
        ),
      );
      const successes = results.filter(
        (result) => result.status === "fulfilled",
      ).length;
      for (const result of results)
        if (result.status === "rejected")
          assert.equal(
            result.reason.response?.code,
            "MACHINE_KEY_RATE_LIMITED",
          );
      assert.equal(successes, 3);
      c.trace("assertion", {
        name: "20 simultaneous verifications with quota 3",
        successes,
        refused: results.length - successes,
      });
    },
  );
  await t.test(
    "database verification failure is a retryable outage, not an invalid credential",
    async () => {
      const key = await issue("verification-database-fault");
      await c.database.query(
        "ALTER TABLE api_key RENAME TO api_key_unavailable",
      );
      try {
        const result = await c.machineAuth.api.verifyApiKey({
          body: {
            configId: "machine",
            key: key.key,
            permissions: { "warehouse.receipts": ["event:create"] },
          },
        });
        c.trace("assertion", {
          name: "Better Auth database failure classification",
          code: result.error?.code,
          messageType: typeof result.error?.message,
        });
        await assert.rejects(
          c.machineKeys.verifyBearer(`Bearer ${key.key}`, {
            "warehouse.receipts": ["event:create"],
          }),
          (error) => {
            assert.equal(error.status, 503);
            return true;
          },
        );
        const response = await http.request(
          "POST",
          `/api/integrations/sources/${sourceSystem}/flows/warehouse.receipts/events`,
          {
            token: key.key,
            body: {
              eventId: randomUUID(),
              objectId: randomUUID(),
              version: "1",
              type: "RECEIPT_CHANGED",
            },
            expected: 503,
          },
        );
        assert.equal(
          response.body.code,
          "MACHINE_KEY_VERIFICATION_UNAVAILABLE",
        );
      } finally {
        await c.database.query(
          "ALTER TABLE api_key_unavailable RENAME TO api_key",
        );
      }
      await c.machineKeys.verifyBearer(`Bearer ${key.key}`, {
        "warehouse.receipts": ["event:create"],
      });
    },
  );
  await t.test(
    "revocation versus 20 deliveries: every accepted event exists, all other failures are authentication",
    async () => {
      const key = await issue("revoke-race");
      const ids = Array.from({ length: 20 }, () => randomUUID());
      const results = await Promise.allSettled([
        ...ids.map((eventId) =>
          c.coreEvents.accept(
            sourceSystem,
            "warehouse.receipts",
            {
              eventId,
              objectId: randomUUID(),
              version: "1",
              type: "RECEIPT_CHANGED",
            },
            `Bearer ${key.key}`,
          ),
        ),
        c.coreKeys.revoke(sourceSystem, key.id, c.admin.id),
      ]);
      assert.equal(results.at(-1).status, "fulfilled");
      for (const [index, result] of results.slice(0, -1).entries()) {
        if (result.status === "rejected")
          assert.equal(result.reason.response?.code, "MACHINE_KEY_INVALID");
        const exists = await c.prisma.integrationEvent.count({
          where: {
            sourceId,
            flowCode: "warehouse.receipts",
            eventId: ids[index],
          },
        });
        assert.equal(exists, result.status === "fulfilled" ? 1 : 0);
      }
      await assert.rejects(
        c.coreEvents.accept(
          sourceSystem,
          "warehouse.receipts",
          {
            eventId: randomUUID(),
            objectId: randomUUID(),
            version: "1",
            type: "RECEIPT_CHANGED",
          },
          `Bearer ${key.key}`,
        ),
        code("MACHINE_KEY_INVALID"),
      );
    },
  );
  await t.test(
    "audit SQL failure after Stock mutation rolls back balance, placement, progress and request key",
    async () => {
      const receipt = await c.manual("7.125");
      const quantityBefore = await c.quantity(),
        auditBefore = await c.prisma.auditLog.count();
      const payload = c.placement("2.125");
      const originalAudit = c.audit.writeFieldChanges;
      let writes = 0;
      c.audit.writeFieldChanges = async (params) => {
        writes++;
        return c.realAudit.writeFieldChanges(
          writes === 2 ? { ...params, userId: randomUUID() } : params,
        );
      };
      try {
        await assert.rejects(
          c.placements.place(
            receipt.id,
            receipt.lines[0].id,
            payload,
            c.keeper.id,
          ),
          (error) => {
            assert.equal(error.code, "P2003");
            return true;
          },
        );
      } finally {
        c.audit.writeFieldChanges = originalAudit;
      }
      assert.equal(writes, 2);
      assert.equal(await c.quantity(), quantityBefore);
      assert.equal(
        await c.prisma.warehouseReceiptPlacement.count({
          where: { requestKey: payload.requestKey },
        }),
        0,
      );
      assert.equal(await c.prisma.auditLog.count(), auditBefore);
      assert.equal((await c.receipts.findOne(receipt.id)).status, "RECEIVED");
      await c.placements.place(
        receipt.id,
        receipt.lines[0].id,
        payload,
        c.keeper.id,
      );
      assert.equal(
        (await c.receipts.findOne(receipt.id)).lines[0].placed,
        "2.125",
      );
      c.trace("assertion", {
        name: "SQL audit failure after physical mutation: no partial writes, same requestKey retried successfully",
      });
    },
  );
  await t.test(
    "maximum Numeric(14,3) balance is exact; overflow rolls back the whole placement",
    async () => {
      const item = await c.prisma.warehouseItem.create({
        data: {
          article: c.namespace + "-max",
          name: "Numeric limit",
          unit: "шт",
        },
      });
      const receipt = await c.manual("99999999999.999", {
        lines: [{ itemId: String(item.id), quantity: "99999999999.999" }],
      });
      await c.place(receipt, "99999999999.999");
      const second = await c.manual("0.001", {
        lines: [{ itemId: String(item.id), quantity: "0.001" }],
      });
      await assert.rejects(
        c.place(second, "0.001"),
        code("WAREHOUSE_STOCK_QUANTITY_OVERFLOW"),
      );
      assert.equal(
        (
          await c.prisma.warehouseBalance.findUniqueOrThrow({
            where: {
              itemId_storageLocationId: {
                itemId: item.id,
                storageLocationId: c.location.id,
              },
            },
          })
        ).quantity.toString(),
        "99999999999.999",
      );
      assert.equal((await c.receipts.findOne(second.id)).lines[0].placed, "0");
    },
  );
}
