import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
export const loadReceiptPeriod = (file) =>
  require("../../../backend/dist/src/warehouse/receipt-integration/" + file);

export async function createReceiptPeriodFixture(c) {
  const { OneCInvoicePeriodImportService } = loadReceiptPeriod(
    "one-c-invoice-period-import.service.js",
  );
  const { OneCInvoiceDocumentImport } = loadReceiptPeriod(
    "one-c-invoice-document-import.js",
  );
  const importer = new OneCInvoiceDocumentImport(c.importer);
  const service = new OneCInvoicePeriodImportService(
    c.prisma,
    c.registry,
    importer,
  );
  const warehouses = [randomUUID(), randomUUID(), randomUUID()];
  const item = randomUUID(),
    order = randomUUID();
  const invoice = {
    id: randomUUID(),
    number: "100",
    date: "2026-11-14T07:00:00",
    status: "CREATED",
    lines: warehouses.map((warehouse_id, index) => ({
      row_no: index + 1,
      warehouse_id,
      warehouse_name: "External",
      item_id: item,
      item_article: c.item.article,
      item_name: c.item.name,
      item_unit: c.item.unit,
      item_type: "Товар",
      quantity: 2,
      order_id: index === 0 ? order : "",
      order_number: index === 0 ? "reference" : "",
    })),
  };
  const payload = { total: 1, extra: [], query: undefined };
  const server = createServer((request, response) => {
    response.setHeader("Content-Type", "application/json");
    const url = new URL(request.url, "http://localhost");
    if (url.pathname.startsWith("/ERP/odata/")) {
      const rows = [
        {
          Ref_Key: order,
          Number: "canonical",
          IR_Проект: "Order",
          Date: invoice.date,
          Статус: "КОбеспечению",
          Posted: true,
          DeletionMark: false,
        },
      ];
      response.end(
        JSON.stringify({
          value: rows.slice(Number(url.searchParams.get("$skip"))),
        }),
      );
      return;
    }
    payload.query = url.searchParams;
    response.end(
      JSON.stringify({
        Start_number: 1,
        Total_number: payload.total,
        data: [invoice, ...payload.extra],
      }),
    );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const close = () => new Promise((resolve) => server.close(resolve));
  try {
    const createSource = (name) =>
      c.coreSources.create(
        {
          name,
          systemType: "ONE_C",
          baseUrl: `http://127.0.0.1:${server.address().port}/ERP/hs/docs/`,
          authorization: "Bearer receipt-period-test",
          flows: [
            {
              flowCode: "warehouse.receipts",
              configVersion: 1,
              config: {},
              isActive: true,
            },
          ],
        },
        c.admin.id,
      );
    const [a, b] = await Promise.all([
      createSource("Period A"),
      createSource("Period B"),
    ]);
    const bind = (id) =>
      c.integrationWarehouses.save(
        a.code,
        {
          externalId: id.toUpperCase(),
          warehouseId: String(c.warehouse.id),
        },
        c.admin.id,
      );
    await bind(warehouses[0]);
    await bind(warehouses[1]);
    await c.prisma.warehouseItemExternalLink.create({
      data: {
        sourceSystem: a.code,
        externalId: item.toUpperCase(),
        itemId: c.item.id,
        confirmedBy: c.admin.id,
        sourceArticle: c.item.article,
        sourceName: c.item.name,
      },
    });
    const period = {
      dateFrom: "2026-11-14T00:00:00",
      dateTo: "2026-11-14T23:59:59",
    };
    const run = (source = a) => service.importPeriod(source.code, period);
    const receipts = () =>
      c.prisma.warehouseReceipt.findMany({
        where: {
          sourceOperationId: { startsWith: "invoice:" + invoice.id + ":" },
        },
        orderBy: { id: "asc" },
        include: { lines: true },
      });
    const history = () => c.prisma.$queryRaw`
        SELECT version,payload FROM warehouse_invoice_snapshot_versions
        WHERE invoice_id=${invoice.id}::uuid ORDER BY version`;

    return {
      a,
      b,
      warehouses,
      item,
      order,
      invoice,
      payload,
      server,
      bind,
      period,
      run,
      receipts,
      history,
      importer,
      service,
      createSource,
      close,
    };
  } catch (error) {
    await close();
    throw error;
  }
}
