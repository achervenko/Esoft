const ppePermissionRoles = {
  read: ["admin", "ppe_specialist", "accounting_specialist"],
  manageCatalog: ["admin", "ppe_specialist", "accounting_specialist"],
  manageEmployeeSizes: ["admin", "ppe_specialist"],
  manageNorms: ["admin", "ppe_specialist"],
  issue: ["admin", "accounting_specialist"],
  backdate: ["admin"],
} as const;

type PpePermission = keyof typeof ppePermissionRoles;

function hasPpePermission(role: unknown, permission: PpePermission) {
  const roles: readonly string[] = ppePermissionRoles[permission];
  return typeof role === "string" && roles.includes(role);
}

export function canReadPpe(role: unknown) {
  return hasPpePermission(role, "read");
}

export function canManagePpeCatalog(role: unknown) {
  return hasPpePermission(role, "manageCatalog");
}

export function canManageEmployeeSizes(role: unknown) {
  return hasPpePermission(role, "manageEmployeeSizes");
}

export function canManagePpeNorms(role: unknown) {
  return hasPpePermission(role, "manageNorms");
}

export function canIssuePpe(role: unknown) {
  return hasPpePermission(role, "issue");
}

export function canBackdatePpeIssue(role: unknown) {
  return hasPpePermission(role, "backdate");
}
