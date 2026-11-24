import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  load = (p) => require("../../../backend/dist/src/" + p);
export async function createReceiptTestDomain(prisma, audit) {
  const { WarehouseReceiptsService } = load(
    "warehouse/receipts/receipts.service.js",
  );
  const { WarehouseReceiptsQueryService } = load(
    "warehouse/receipts/receipts-query.service.js",
  );
  const { WarehouseReceiptPlacementsService } = load(
    "warehouse/receipts/receipt-placements.service.js",
  );
  const { WarehouseReceiptItemMappingService } = load(
    "warehouse/receipts/receipt-item-mapping.service.js",
  );
  const { WarehouseReceiptReconciliationService } = load(
    "warehouse/receipts/receipt-reconciliation.service.js",
  );
  const { WarehouseReceiptConflictResolutionService } = load(
    "warehouse/receipts/receipt-conflict-resolution.service.js",
  );
  const { WarehouseReceiptImportService } = load(
    "warehouse/receipts/receipt-import.service.js",
  );
  const { NotificationsService } = load(
    "notifications/notifications.service.js",
  );
  const notifications = new NotificationsService(prisma);
  const { WarehouseNotificationsService } = load(
    "warehouse/warehouse-notifications.service.js",
  );
  const warehouseNotifications = new WarehouseNotificationsService(
    notifications,
  );
  const { WarehouseStockService } = load("warehouse/stock/stock.service.js"),
    { WarehouseStockQueryService } = load(
      "warehouse/stock/stock-query.service.js",
    );
  const { WarehouseCatalogService } = load(
    "warehouse/catalog/catalog.service.js",
  );
  const { WarehouseReservationManager } = load(
    "warehouse/reservations/reservation-manager.service.js",
  );
  const { WarehouseReceiptOrderPlacementService } = load(
    "warehouse/receipts/receipt-order-placement.service.js",
  );
  const { WarehouseCatalogUsagePolicy } = load(
    "warehouse/catalog/catalog-usage.policy.js",
  );
  const { WarehouseCatalogExternalLinksService } = load(
    "warehouse/catalog/catalog-external-links.service.js",
  );
  const { ReceiptCatalogUsagePolicy } = load(
    "warehouse/receipts/receipt-catalog-usage.policy.js",
  );
  const usage = new WarehouseCatalogUsagePolicy();
  const receiptUsage = new ReceiptCatalogUsagePolicy(usage);
  receiptUsage.onModuleInit();
  const namespace = randomUUID();
  const keeper = await prisma.user.create({
      data: {
        id: namespace + "keeper",
        name: "Keeper",
        email: namespace + "keeper@test.invalid",
        role: "storekeeper",
      },
    }),
    admin = await prisma.user.create({
      data: {
        id: namespace + "admin",
        name: "Admin",
        email: namespace + "admin@test.invalid",
        role: "admin",
      },
    });
  const warehouse = await prisma.warehouse.create({
      data: { name: namespace + "warehouse" },
    }),
    foreign = await prisma.warehouse.create({
      data: { name: namespace + "foreign" },
    });
  const location = await prisma.warehouseStorageLocation.create({
      data: { warehouseId: warehouse.id, name: "A" },
    }),
    target = await prisma.warehouseStorageLocation.create({
      data: { warehouseId: warehouse.id, name: "B" },
    }),
    other = await prisma.warehouseStorageLocation.create({
      data: { warehouseId: foreign.id, name: "C" },
    });
  const item = await prisma.warehouseItem.create({
    data: { article: namespace, name: "Bearing", unit: "шт" },
  });
  const stock = new WarehouseStockService(
      new WarehouseStockQueryService(prisma),
      audit,
    ),
    catalog = new WarehouseCatalogService(prisma, audit, usage),
    links = new WarehouseCatalogExternalLinksService(catalog, audit),
    receipts = new WarehouseReceiptsService(prisma, audit, catalog),
    placements = new WarehouseReceiptPlacementsService(
      prisma,
      stock,
      audit,
      catalog,
      new WarehouseReceiptOrderPlacementService(
        stock,
        new WarehouseReservationManager(audit, stock),
      ),
      warehouseNotifications,
    ),
    itemMapping = new WarehouseReceiptItemMappingService(
      prisma,
      audit,
      catalog,
      links,
    ),
    reconciliation = new WarehouseReceiptReconciliationService(
      prisma,
      audit,
      warehouseNotifications,
    ),
    conflictResolution = new WarehouseReceiptConflictResolutionService(
      prisma,
      audit,
      warehouseNotifications,
    ),
    importer = new WarehouseReceiptImportService(
      audit,
      links,
      catalog,
      warehouseNotifications,
    );
  const { ReceiptIntegrationWarehousesService } = load(
    "warehouse/receipts/receipt-source-warehouses.service.js",
  );
  const integrationWarehouses = new ReceiptIntegrationWarehousesService(
    prisma,
    audit,
  );
  const queries = new WarehouseReceiptsQueryService(prisma);
  return {
    stock,
    catalog,
    links,
    usage,
    receiptUsage,
    namespace,
    keeper,
    admin,
    warehouse,
    foreign,
    location,
    target,
    other,
    item,
    receipts,
    placements,
    itemMapping,
    reconciliation,
    conflictResolution,
    importer,
    notifications,
    warehouseNotifications,
    integrationWarehouses,
    queries,
  };
}
