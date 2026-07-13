export type EmployeeProfile = {
  displayName: string;
  firstName: string;
  fullName: string;
  id: number;
  lastName: string;
  middleName: string | null;
  position: string;
};

export type UserProfile = {
  displayUsername?: string | null;
  email?: string | null;
  employee: EmployeeProfile | null;
  id: string;
  name?: string | null;
  photo: UserPhoto | null;
  role?: string | null;
  username?: string | null;
};

export type UserPhoto = {
  largeUrl: string;
  mediumUrl: string;
  smallUrl: string;
  updatedAt: string;
};

const API_URL = import.meta.env.VITE_API_URL || '';

export async function getUserProfile(userId: string) {
  const response = await fetch(`${API_URL}/api/users/${userId}/profile`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Не удалось загрузить профиль пользователя.');
  }

  return (await response.json()) as UserProfile;
}
