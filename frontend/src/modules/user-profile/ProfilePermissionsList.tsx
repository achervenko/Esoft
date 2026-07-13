import type { ProfilePermissionAccess } from "./profile-access";

type ProfilePermissionsListProps = {
  permissions: ProfilePermissionAccess[];
};

export function ProfilePermissionsList({
  permissions,
}: ProfilePermissionsListProps) {
  return (
    <ul className="user-profile-permissions">
      {permissions.map((permission) => (
        <li key={permission.title}>
          <div>
            <strong>{permission.title}</strong>
            <span>{permission.description}</span>
          </div>

          <span
            className={
              permission.allowed
                ? "user-profile-permission-badge allowed"
                : "user-profile-permission-badge denied"
            }
          >
            {permission.allowed ? "Доступно" : "Недоступно"}
          </span>
        </li>
      ))}
    </ul>
  );
}
