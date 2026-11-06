import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

export async function adversarialReceiptTransport(c, t) {
  let sourceSystem = c.sourceSystem + "-transport-deep";
  let mode, document;
  const server = createServer((_req, res) => {
    res.setHeader("content-type", "application/json");
    if (mode === "status") {
      res.writeHead(503);
      res.end("source-secret-must-not-appear");
    } else if (mode === "redirect") {
      res.writeHead(302, { location: "/somewhere" });
      res.end();
    } else if (mode === "html") {
      res.setHeader("content-type", "text/html");
      res.end("<h1>source-secret-must-not-appear</h1>");
    } else if (mode === "wrong-mime") {
      res.setHeader("content-type", "application/jsonp");
      res.end(JSON.stringify(document));
    } else if (mode === "upper-mime") {
      res.setHeader("content-type", "Application/JSON; Charset=UTF-8");
      res.end(JSON.stringify(document));
    } else if (mode === "invalid-json")
      res.end('{"source-secret-must-not-appear":');
    else if (mode === "invalid-utf8") {
      const body = JSON.stringify(document).replace("125", "INVALID-BYTES");
      const [before, after] = body.split("INVALID-BYTES");
      res.end(
        Buffer.concat([
          Buffer.from(before),
          Buffer.from([0xc3, 0x28]),
          Buffer.from(after),
        ]),
      );
    } else if (mode === "oversize-header") {
      res.setHeader("content-length", 3_000_000);
      res.end("x");
    } else if (mode === "oversize-stream") {
      res.write(" ".repeat(1_048_576));
      res.end(" ".repeat(1_048_578));
    } else if (mode === "truncated") {
      res.setHeader("content-length", 5000);
      res.end("{");
    } else if (mode === "disconnect") res.destroy();
    else if (mode === "timeout") {
      /* Deliberately keep the source silent until client abort. */
    } else res.end(JSON.stringify(document));
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
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
      baseUrl: `http://127.0.0.1:${server.address().port}/`,
      authorization: "Bearer isolated-source-secret",
    },
    c.admin.id,
  );
  sourceSystem = configuredSource.code;
  const sourceId = configuredSource.id;
  await c.integrationWarehouses.save(
    sourceSystem,
    {
      externalId: c.source().warehouse.id,
      warehouseId: String(c.warehouse.id),
    },
    c.admin.id,
  );
  const key = await c.coreKeys.create(
    sourceSystem,
    {
      flows: { "warehouse.receipts": ["event:create"] },
      name: "Transport adversarial key",
    },
    c.admin.id,
  );
  const beforeQuantity = await c.quantity();
  try {
    for (const scenario of [
      ["status", "ONE_C_HTTP_503"],
      ["redirect", "ONE_C_HTTP_UNAVAILABLE"],
      ["html", "ONE_C_CONTENT_TYPE"],
      ["wrong-mime", "ONE_C_CONTENT_TYPE"],
      ["invalid-json", "ONE_C_INVALID_JSON"],
      ["invalid-utf8", "ONE_C_INVALID_UTF8"],
      ["oversize-header", "ONE_C_BODY_TOO_LARGE"],
      ["oversize-stream", "ONE_C_BODY_TOO_LARGE"],
      ["truncated", "ONE_C_HTTP_UNAVAILABLE"],
      ["disconnect", "ONE_C_HTTP_UNAVAILABLE"],
      ["timeout", "ONE_C_HTTP_TIMEOUT"],
      ["wrong-document", "ONE_C_OBJECT_MISMATCH"],
      ["invalid-domain", "WAREHOUSE_RECEIPT_INVALID"],
    ])
      await t.test(
        `source fault ${scenario[0]}: durable retry, no document/stock/secret leak`,
        async () => {
          mode = scenario[0];
          document = c.source();
          const objectId = document.id;
          if (mode === "wrong-document") document.id = randomUUID();
          if (mode === "invalid-domain") document.lines = [];
          const event = { objectId };
          const accepted = await c.coreEvents.accept(
            sourceSystem,
            "warehouse.receipts",
            event,
            `Bearer ${key.key}`,
          );
          const queued = await c.prisma.integrationEvent.findUniqueOrThrow({
            where: { id: BigInt(accepted.id) },
          });
          const started = performance.now();
          await c.coreWorker.process(queued.id);
          const stored = await c.prisma.integrationEvent.findUniqueOrThrow({
            where: { id: queued.id },
          });
          const permanent = [
            "invalid-json",
            "invalid-utf8",
            "oversize-header",
            "oversize-stream",
            "invalid-domain",
            "wrong-document",
          ].includes(mode);
          assert.equal(stored.status, permanent ? "FAILED" : "PENDING");
          assert.ok(
            stored.lastErrorCode?.startsWith(scenario[1]),
            stored.lastErrorCode,
          );
          assert.equal(stored.attempts, 1);
          assert.ok(stored.nextAttemptAt > stored.receivedAt);
          assert.ok(!stored.lastErrorCode.includes("secret"));
          assert.equal(
            await c.prisma.warehouseReceipt.count({
              where: { sourceSystem, sourceOperationId: objectId },
            }),
            0,
          );
          assert.equal(await c.quantity(), beforeQuantity);
          c.trace("assertion", {
            name: "transport fault rollback",
            mode,
            lastError: stored.lastErrorCode,
            durationMs: Math.round(performance.now() - started),
          });
          // The same durable event succeeds after source recovery, without a new eventId.
          mode = "valid";
          document = c.source({ id: objectId });
          delete document.version;
          if (stored.status === "FAILED")
            await c.coreEvents.retry(queued.id, c.admin.id);
          else
            await c.prisma.integrationEvent.update({
              where: { id: queued.id },
              data: { nextAttemptAt: new Date(0) },
            });
          await c.coreWorker.process(queued.id);
          assert.equal(
            (
              await c.prisma.integrationEvent.findUniqueOrThrow({
                where: { id: queued.id },
              })
            ).status,
            "PROCESSED",
          );
        },
      );
    await t.test(
      "case-insensitive JSON MIME is accepted without altering stock",
      async () => {
        mode = "upper-mime";
        document = c.source();
        const event = {
          eventId: randomUUID(),
          objectId: document.id,
          version: "1",
          type: "RECEIPT_CHANGED",
        };
        await c.coreEvents.accept(
          sourceSystem,
          "warehouse.receipts",
          event,
          `Bearer ${key.key}`,
        );
        const queued = await c.prisma.integrationEvent.findUniqueOrThrow({
          where: {
            sourceId_flowCode_eventId: {
              sourceId,
              flowCode: "warehouse.receipts",
              eventId: event.eventId,
            },
          },
        });
        await c.coreWorker.process(queued.id);
        const stored = await c.prisma.integrationEvent.findUniqueOrThrow({
          where: { id: queued.id },
        });
        assert.equal(stored.status, "PROCESSED", stored.lastErrorCode);
        assert.equal(await c.quantity(), beforeQuantity);
      },
    );
  } finally {
    server.closeAllConnections();
    await new Promise((ok) => server.close(ok));
  }
}
