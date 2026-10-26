export const WAREHOUSE_PERMISSIONS = {
  PROJECTS_READ: 'warehouse.projects.read',
  RESERVATIONS_MANAGE: 'warehouse.reservations.manage',
  STOCK_READ: 'warehouse.stock.read',
  STORAGE_LOCATIONS_READ: 'warehouse.storage-locations.read',
  STORAGE_LOCATIONS_MANAGE: 'warehouse.storage-locations.manage',
  ISSUES_MANAGE: 'warehouse.issues.manage',
  OVERRIDE_RESERVATION: 'warehouse.reservations.override',
  ISSUE_SHEETS_MANAGE: 'warehouse.issue-sheets.manage',
  CATALOG_MANAGE: 'warehouse.catalog.manage',
  ADJUSTMENTS_MANAGE: 'warehouse.adjustments.manage',
} as const;
