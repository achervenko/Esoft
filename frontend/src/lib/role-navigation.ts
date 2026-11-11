import { hasPermission } from "../shared/lib/permissions";
import { DEFAULT_AUTH_ROUTE } from "./hash-router";
import {
  canReadEquipment,
  canEditEquipment,
} from "../modules/equipment-permissions/equipment-permissions";
import {
  canReadPpe,
  canManageEmployeeSizes,
} from "../modules/ppe-permissions/ppe-permissions";
import {
  canManageUsers,
  canViewCalendar,
  canManageChecklists,
  canManageProductionCalendar,
} from "../shared/lib/roles";

export function getDefaultAuthRoute(permissions: unknown) {
  if (canReadEquipment(permissions)) return DEFAULT_AUTH_ROUTE;
  if (canReadPpe(permissions)) return "#/ppe";
  return "#/profile";
}

export function canAccessWorkspaceRoute(permissions: unknown, route: string) {
  const path = route.split("?")[0];
  if (
    path === "#/orders" ||
    /^#\/orders\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      path,
    )
  )
    return hasPermission(permissions, "orders.read");
  if (path === "#/warehouse/receipts/new")
    return (
      hasPermission(permissions, "warehouse.receipts.read") &&
      hasPermission(permissions, "warehouse.receipts.manage")
    );
  const receiptMatch = path.match(/^#\/warehouse\/receipts\/([1-9]\d{0,18})$/);
  if (
    path === "#/warehouse/receipts" ||
    (receiptMatch && BigInt(receiptMatch[1]) <= 9223372036854775807n)
  )
    return hasPermission(permissions, "warehouse.receipts.read");
  if (path === "#/warehouse/reservations")
    return hasPermission(permissions, "warehouse.reservations.read");
  if (path === "#/warehouse/stock")
    return hasPermission(permissions, "warehouse.stock.read");
  if (path === "#/warehouse/catalog")
    return hasPermission(permissions, "warehouse.catalog.manage");
  if (path === "#/search") return hasPermission(permissions, "search.read");
  if (path === "#/profile")
    return hasPermission(permissions, "users.profile.read");
  if (
    path === "#/ppe" ||
    /^#\/ppe\/(employees|positions)\/[1-9]\d*$/.test(path)
  )
    return canReadPpe(permissions);
  if (path.startsWith("#/ppe")) return false;
  if (path === "#/dictionaries")
    return (
      hasPermission(permissions, "dictionaries.manage") ||
      canManageEmployeeSizes(permissions) ||
      hasPermission(permissions, "warehouse.storage-locations.read")
    );
  if (path === "#/users")
    return (
      canManageUsers(permissions) ||
      hasPermission(permissions, "integrations.manage")
    );
  if (path === "#/production-calendar")
    return canManageProductionCalendar(permissions);
  if (path === "#/calendar") return canViewCalendar(permissions);
  if (
    path === "#/checklist-admin" ||
    /^#\/checklist-admin\/templates\/(new|[1-9]\d*)$/.test(path)
  )
    return canManageChecklists(permissions);
  if (
    path === "#/equipment/create" ||
    /^#\/equipment\/[1-9]\d*\/edit$/.test(path)
  )
    return canEditEquipment(permissions);
  if (path === "#/my-checklists" || /^#\/my-checklists\/[1-9]\d*$/.test(path))
    return hasPermission(permissions, "checklists.work");
  if (path === "#/dashboard")
    return hasPermission(permissions, "equipment.progress.read");
  if (path === "#/equipment" || /^#\/equipment\/[1-9]\d*$/.test(path))
    return canReadEquipment(permissions);
  return false;
}
