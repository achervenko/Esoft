import { Plus } from "lucide-react";
import { Notice } from "../../shared/ui/Notice";
import { EmployeeFormModal } from "./EmployeeFormModal";
import { EmployeesTable } from "./EmployeesTable";
import { PasswordFormModal } from "./PasswordFormModal";
import { UserAccountFormModal } from "./UserAccountFormModal";
import { UserAccountsTable } from "./UserAccountsTable";
import { useUsersAdminPage } from "./useUsersAdminPage";
import "./UsersPage.css";

type UsersPageProps = {
  currentUserId?: string | null;
  userRole: string | null;
};

export function UsersPage({ currentUserId, userRole }: UsersPageProps) {
  const page = useUsersAdminPage({ userRole });

  if (!page.isAdmin) {
    return (
      <section className="users-page">
        <Notice tone="error">
          Недостаточно прав для управления пользователями.
        </Notice>
      </section>
    );
  }

  return (
    <section className="users-page">
      <header className="users-page-header">
        <h1>Пользователи</h1>
      </header>

      <div className="equipment-edit-tabs users-tabs" role="tablist">
        <button
          className={page.activeTab === "employees" ? "active" : undefined}
          onClick={() => page.setActiveTab("employees")}
          type="button"
        >
          Сотрудники
        </button>
        <button
          className={page.activeTab === "accounts" ? "active" : undefined}
          onClick={() => page.setActiveTab("accounts")}
          type="button"
        >
          Учётные записи
        </button>
      </div>

      {page.error ? <Notice tone="error">{page.error}</Notice> : null}
      {page.message ? <Notice tone="success">{page.message}</Notice> : null}

      <section className="users-card">
        <header>
          <h2>
            {page.activeTab === "employees" ? "Сотрудники" : "Учётные записи"}
          </h2>
          <button
            className="users-primary-button"
            onClick={() =>
              page.activeTab === "employees"
                ? page.setEmployeeForm("new")
                : page.setUserForm("new")
            }
            type="button"
          >
            <Plus size={18} />
            {page.activeTab === "employees"
              ? "Добавить сотрудника"
              : "Добавить учётку"}
          </button>
        </header>

        {page.isLoading ? <p className="users-state">Загрузка...</p> : null}
        {!page.isLoading && page.activeTab === "employees" ? (
          <EmployeesTable
            employees={page.employees}
            onDelete={(employee) => void page.removeEmployee(employee)}
            onEdit={page.setEmployeeForm}
          />
        ) : null}
        {!page.isLoading && page.activeTab === "accounts" ? (
          <UserAccountsTable
            currentUserId={currentUserId}
            onChangePassword={page.setPasswordUser}
            onEdit={page.setUserForm}
            onToggleStatus={(user) => void page.toggleUserStatus(user)}
            users={page.users}
          />
        ) : null}
      </section>

      {page.employeeForm ? (
        <EmployeeFormModal
          employee={page.employeeForm === "new" ? null : page.employeeForm}
          isSaving={page.isSaving}
          onClose={() => page.setEmployeeForm(null)}
          onSubmit={(payload) => void page.saveEmployee(payload)}
        />
      ) : null}

      {page.userForm ? (
        <UserAccountFormModal
          employees={page.employees}
          isSaving={page.isSaving}
          onClose={() => page.setUserForm(null)}
          onSubmit={(payload) => void page.saveUser(payload)}
          roles={page.roles}
          user={page.userForm === "new" ? null : page.userForm}
        />
      ) : null}

      {page.passwordUser ? (
        <PasswordFormModal
          isSaving={page.isSaving}
          onClose={() => page.setPasswordUser(null)}
          onSubmit={(password) => void page.setPassword(password)}
          user={page.passwordUser}
        />
      ) : null}
    </section>
  );
}
