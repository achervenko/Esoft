import { hasPermission } from "../../shared/lib/permissions";

export function canReadPpe(permissions: unknown) {
  return hasPermission(permissions, "ppe.read");
}

export function canManagePpeCatalog(permissions: unknown) {
  return hasPermission(permissions, "ppe.catalog.manage");
}

export function canManageEmployeeSizes(permissions: unknown) {
  return hasPermission(permissions, "ppe.employee-sizes.manage");
}

export function canManagePpeNorms(permissions: unknown) {
  return hasPermission(permissions, "ppe.norms.manage");
}

export function canIssuePpe(permissions: unknown) {
  return hasPermission(permissions, "ppe.issue");
}

export function canBackdatePpeIssue(permissions: unknown) {
  return hasPermission(permissions, "ppe.issue.backdate");
}
