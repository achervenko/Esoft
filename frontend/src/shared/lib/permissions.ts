export type UserPermissions = readonly string[] | null | undefined;

export function hasPermission(permissions: unknown, permission: string): boolean {
  return Array.isArray(permissions) && permissions.includes(permission);
}
