import { useState } from "react";
import type { EmployeeProfile } from "../../shared/api/user-profile-api";
import type { UserPhoto } from "../../shared/api/user-profile-api";
import { AsyncImage } from "../../shared/ui/AsyncImage";
import {
  getProfileModuleAccess,
  getProfilePermissionAccess,
  getProfileRoleLabel,
} from "./profile-access";
import { ProfilePermissionsList } from "./ProfilePermissionsList";
import { UserPhotoPreviewModal } from "./UserPhotoPreviewModal";

type UserProfileCardUser = {
  displayUsername?: string | null;
  email?: string | null;
  employee?: EmployeeProfile | null;
  name?: string | null;
  photo?: UserPhoto | null;
  role?: string | null;
  username?: string | null;
};

type UserProfileCardProps = {
  user: UserProfileCardUser | null;
};

export function UserProfileCard({ user }: UserProfileCardProps) {
  const [isPhotoOpen, setIsPhotoOpen] = useState(false);
  const employee = user?.employee ?? null;
  const fullName = getFullName(user);
  const roleLabel = getProfileRoleLabel(user?.role);
  const modules = getProfileModuleAccess(user?.role);
  const permissions = getProfilePermissionAccess(user?.role);
  const login = user?.username || user?.displayUsername || "Не указан";
  const position = employee?.position || "Не указана";

  return (
    <div className="user-profile-layout">
      <section className="user-profile-card">
        <button
          aria-label="Открыть фото пользователя"
          className="user-profile-photo"
          disabled={!user?.photo?.largeUrl}
          onClick={() => setIsPhotoOpen(true)}
          type="button"
        >
          {user?.photo?.mediumUrl ? (
            <AsyncImage src={user.photo.mediumUrl} />
          ) : (
            <span>{getInitials(fullName)}</span>
          )}
        </button>

        <div className="user-profile-main">
          <span className="user-profile-role">{roleLabel}</span>
          <h2>{fullName}</h2>
          <p>{position}</p>
        </div>
      </section>

      <section className="user-profile-card user-profile-details">
        <h2>Данные пользователя</h2>
        <dl>
          <div>
            <dt>ФИО</dt>
            <dd>{fullName}</dd>
          </div>
          <div>
            <dt>Должность</dt>
            <dd>{position}</dd>
          </div>
          <div>
            <dt>Логин</dt>
            <dd>{login}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{user?.email || "Не указан"}</dd>
          </div>
        </dl>
      </section>

      <section className="user-profile-card user-profile-modules">
        <h2>Доступные модули</h2>
        <ul>
          {modules.map((module) => (
            <li key={module.title}>
              <strong>{module.title}</strong>
              <span>{module.description}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="user-profile-card user-profile-access">
        <h2>Права доступа</h2>
        <ProfilePermissionsList permissions={permissions} />
      </section>

      {isPhotoOpen && user?.photo?.largeUrl ? (
        <UserPhotoPreviewModal
          imageUrl={user.photo.largeUrl}
          onClose={() => setIsPhotoOpen(false)}
        />
      ) : null}
    </div>
  );
}

function getFullName(user: UserProfileCardUser | null) {
  return (
    user?.employee?.fullName ||
    user?.name ||
    user?.displayUsername ||
    user?.username ||
    "Пользователь"
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
