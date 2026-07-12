import { Edit2, KeyRound, Power } from "lucide-react";
import { DataTable, type DataTableColumn } from "../../shared/ui/DataTable";
import type { AdminUserAccount } from "../../shared/api/users-admin-api";
import { formatDate } from "./users-page-utils";

type UserAccountsTableProps = {
  currentUserId?: string | null;
  users: AdminUserAccount[];
  onChangePassword: (user: AdminUserAccount) => void;
  onEdit: (user: AdminUserAccount) => void;
  onToggleStatus: (user: AdminUserAccount) => void;
};

const userColumns = ({
  currentUserId,
  onChangePassword,
  onEdit,
  onToggleStatus,
}: Omit<UserAccountsTableProps, "users">): Array<
  DataTableColumn<AdminUserAccount, string>
> => [
  {
    key: "employee",
    label: "Сотрудник",
    render: (user) => user.employee?.fullName ?? "Не указан",
    sortValue: (user) => user.employee?.fullName ?? "",
  },
  {
    key: "email",
    label: "Email",
    render: (user) => user.email,
    sortValue: (user) => user.email,
  },
  {
    key: "username",
    label: "Логин",
    render: (user) => user.username ?? "Не указан",
    sortValue: (user) => user.username ?? "",
  },
  {
    key: "role",
    label: "Роль",
    render: (user) => user.roleLabel,
    sortValue: (user) => user.roleLabel,
  },
  {
    key: "createdAt",
    label: "Создан",
    render: (user) => formatDate(user.createdAt),
    sortValue: (user) => user.createdAt,
  },
  {
    key: "lastLoginAt",
    label: "Последний вход",
    render: (user) => formatDate(user.lastLoginAt),
    sortValue: (user) => user.lastLoginAt ?? "",
  },
  {
    key: "actions",
    label: "",
    render: (user) => (
      <div className="admin-table-actions">
        <button
          aria-label={`Редактировать учётную запись ${user.username || user.email}`}
          className="admin-icon-button"
          onClick={() => onEdit(user)}
          title="Редактировать"
          type="button"
        >
          <Edit2 size={17} />
        </button>
        <button
          aria-label={`Сменить пароль для ${user.username || user.email}`}
          className="admin-icon-button"
          onClick={() => onChangePassword(user)}
          title="Сменить пароль"
          type="button"
        >
          <KeyRound size={17} />
        </button>
        <button
          aria-label={
            user.banned
              ? `Включить учётную запись ${user.username || user.email}`
              : `Отключить учётную запись ${user.username || user.email}`
          }
          className={`admin-icon-button users-status-toggle${
            user.banned ? " banned" : " active"
          }`}
          disabled={user.id === currentUserId && !user.banned}
          onClick={() => onToggleStatus(user)}
          title={user.banned ? "Включить" : "Отключить"}
          type="button"
        >
          <Power size={17} />
        </button>
      </div>
    ),
  },
];

export function UserAccountsTable({
  currentUserId,
  onChangePassword,
  onEdit,
  onToggleStatus,
  users,
}: UserAccountsTableProps) {
  return (
    <DataTable
      columns={userColumns({
        currentUserId,
        onChangePassword,
        onEdit,
        onToggleStatus,
      })}
      defaultSort={{ direction: "asc", key: "employee" }}
      getRowKey={(user) => user.id}
      rows={users}
    />
  );
}
