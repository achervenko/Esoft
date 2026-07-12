import { Plus } from "lucide-react";
import "../../shared/ui/AdminPage.css";
import { Notice } from "../../shared/ui/Notice";
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
      <section className="admin-page users-page">
        <Notice tone="error">
          Недостаточно прав для управления пользователями.
        </Notice>
      </section>
    );
  }

  return (
    <section className="admin-page users-page">
      <header className="admin-page-header users-page-header">
        <h1>Пользователи</h1>
      </header>

      {page.error ? <Notice tone="error">{page.error}</Notice> : null}
      {page.message ? <Notice tone="success">{page.message}</Notice> : null}

      <section className="admin-card users-card">
        <header>
          <h2>Учётные записи</h2>
          <button
            className="admin-primary-button"
            onClick={() => page.setUserForm("new")}
            type="button"
          >
            <Plus size={18} />
            Добавить
          </button>
        </header>

        {page.isLoading ? <p className="admin-state">Загрузка...</p> : null}
        {!page.isLoading ? (
          <UserAccountsTable
            currentUserId={currentUserId}
            onChangePassword={page.setPasswordUser}
            onEdit={page.setUserForm}
            onToggleStatus={(user) => void page.toggleUserStatus(user)}
            users={page.users}
          />
        ) : null}
      </section>

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
