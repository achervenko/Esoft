import { LoadingIndicator } from "../../shared/ui/LoadingIndicator";
import { Plus } from "lucide-react";
import "../../shared/ui/AdminPage.css";
import { Notice } from "../../shared/ui/Notice";
import { PasswordFormModal } from "./PasswordFormModal";
import { UserAccountFormModal } from "./UserAccountFormModal";
import { UserAccountsTable } from "./UserAccountsTable";
import { UserPhotoFormModal } from "./UserPhotoFormModal";
import { useUsersAdminPage } from "./useUsersAdminPage";
import "./UsersPage.css";
import { useState } from "react";
import { hasPermission } from "../../shared/lib/permissions";
import { IntegrationsPanel } from "../../modules/integrations/IntegrationsPanel";
import "../../shared/ui/Tabs.css";

type UsersPageProps = {
  currentUserId?: string | null;
  onCurrentUserChanged?: () => void;
  userPermissions: readonly string[] | null;
};

export function UsersPage({
  currentUserId,
  onCurrentUserChanged,
  userPermissions,
}: UsersPageProps) {
  const [tab, setTab] = useState("accounts");
  const integrationAllowed = hasPermission(
    userPermissions,
    "integrations.manage",
  );
  const page = useUsersAdminPage({
    currentUserId,
    onCurrentUserChanged,
    userPermissions,
  });

  const activeTab = page.usersManageable
    ? integrationAllowed
      ? tab
      : "accounts"
    : "integration";

  if (!page.usersManageable && !integrationAllowed) {
    return (
      <section className="admin-page users-page">
        <Notice tone="error">
          Недостаточно прав для управления пользователями или интеграциями.
        </Notice>
      </section>
    );
  }

  return (
    <section className="admin-page users-page">
      <header className="admin-page-header users-page-header">
        <h1>Пользователи</h1>
      </header>

      {integrationAllowed && (
        <div
          className="equipment-edit-tabs"
          role="tablist"
          aria-label="Администрирование пользователей"
        >
          {page.usersManageable && (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "accounts"}
              className={activeTab === "accounts" ? "active" : ""}
              onClick={() => setTab("accounts")}
            >
              Учётные записи
            </button>
          )}
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "integration"}
            className={activeTab === "integration" ? "active" : ""}
            onClick={() => setTab("integration")}
          >
            Интеграции
          </button>
        </div>
      )}
      {activeTab === "integration" && integrationAllowed ? (
        <IntegrationsPanel permissions={userPermissions} />
      ) : page.usersManageable ? (
        <>
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

            <LoadingIndicator loading={page.isLoading} />
            {!page.isLoading ? (
              <UserAccountsTable
                currentUserId={currentUserId}
                onChangePassword={page.setPasswordUser}
                onEdit={page.setUserForm}
                onPhoto={page.setPhotoUser}
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
              onSubmit={page.saveUser}
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

          {page.photoUser ? (
            <UserPhotoFormModal
              isSaving={page.isSaving}
              onClose={() => page.setPhotoUser(null)}
              onDelete={() => void page.deleteUserPhoto()}
              onSubmit={(file) => void page.saveUserPhoto(file)}
              user={page.photoUser}
            />
          ) : null}
        </>
      ) : null}
    </section>
  );
}
