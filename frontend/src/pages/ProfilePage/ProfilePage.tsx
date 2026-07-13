import { UserProfileCard } from "../../modules/user-profile";
import type { EmployeeProfile, UserPhoto } from "../../shared/api/user-profile-api";
import "./ProfilePage.css";

type ProfilePageUser = {
  displayUsername?: string | null;
  email?: string | null;
  employee?: EmployeeProfile | null;
  name?: string | null;
  photo?: UserPhoto | null;
  role?: string | null;
  username?: string | null;
};

type ProfilePageProps = {
  user: ProfilePageUser | null;
};

export function ProfilePage({ user }: ProfilePageProps) {
  return (
    <section className="profile-page">
      <header className="profile-page-header">
        <h1>Профиль</h1>
      </header>

      <UserProfileCard user={user} />
    </section>
  );
}
