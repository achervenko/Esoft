import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { code } from "./warehouse-receipts-test-context.mjs";
const require = createRequire(import.meta.url);

export async function receiptsKeyAtomicity(c, t) {
  let sourceSystem = c.sourceSystem + "-key-atomicity";
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
  const {
    AuditLogService,
  } = require("../../../backend/dist/src/audit/audit-log.service.js");
  const realAudit = new AuditLogService(c.prisma);

  await t.test(
    "failed audit rolls back an invisible key even when revocation is unavailable",
    async () => {
      const originalCreate = c.machineKeys.create,
        originalRevoke = c.machineKeys.revoke;
      let issued,
        revocations = 0;
      c.machineKeys.create = async (...args) => {
        issued = await originalCreate.apply(c.machineKeys, args);
        assert.equal(
          await c.prisma.apiKey.findUnique({ where: { id: issued.id } }),
          null,
        );
        return issued;
      };
      c.machineKeys.revoke = async () => {
        revocations++;
        throw Error("revocation unavailable");
      };
      c.failAudit(true);
      try {
        await assert.rejects(
          c.coreKeys.create(
            sourceSystem,
            {
              flows: { "warehouse.receipts": ["event:create"] },
              name: "audit-and-revoke-failure",
            },
            c.admin.id,
          ),
          /audit failed/,
        );
      } finally {
        c.failAudit(false);
        c.machineKeys.create = originalCreate;
        c.machineKeys.revoke = originalRevoke;
      }
      assert.ok(issued);
      assert.equal(revocations, 0);
      assert.equal(
        await c.prisma.apiKey.findUnique({ where: { id: issued.id } }),
        null,
      );
      await assert.rejects(
        c.machineKeys.verifyBearer(`Bearer ${issued.key}`, {
          "warehouse.receipts": ["event:create"],
        }),
        code("MACHINE_KEY_INVALID"),
      );
    },
  );

  await t.test(
    "a real audit SQL failure rolls back the key; success commits both",
    async () => {
      const originalAudit = c.audit.writeFieldChanges;
      const missingActor = randomUUID();
      c.audit.writeFieldChanges = (params) =>
        realAudit.writeFieldChanges({ ...params, userId: missingActor });
      try {
        await assert.rejects(
          c.coreKeys.create(
            sourceSystem,
            {
              flows: { "warehouse.receipts": ["event:create"] },
              name: "real-sql-failure",
            },
            c.admin.id,
          ),
          (error) => {
            assert.equal(error.code, "P2003");
            return true;
          },
        );
      } finally {
        c.audit.writeFieldChanges = originalAudit;
      }
      assert.equal(
        await c.prisma.apiKey.count({
          where: {
            referenceId: configuredSource.actorUserId,
            name: "real-sql-failure",
          },
        }),
        0,
      );

      c.audit.writeFieldChanges = (params) =>
        realAudit.writeFieldChanges(params);
      let issued;
      try {
        issued = await c.coreKeys.create(
          sourceSystem,
          {
            flows: { "warehouse.receipts": ["event:create"] },
            name: "real-atomic-success",
          },
          c.admin.id,
        );
      } finally {
        c.audit.writeFieldChanges = originalAudit;
      }
      assert.equal(
        (await c.prisma.apiKey.findUniqueOrThrow({ where: { id: issued.id } }))
          .enabled,
        true,
      );
      assert.equal(
        await c.prisma.auditLog.count({
          where: {
            entityType: "integration_key",
            entityStringId: issued.id,
            userId: c.admin.id,
          },
        }),
        1,
      );
      await c.machineKeys.verifyBearer(`Bearer ${issued.key}`, {
        "warehouse.receipts": ["event:create"],
      });
    },
  );
  await c.coreSources.update(sourceSystem, { isActive: false }, c.admin.id);
}
