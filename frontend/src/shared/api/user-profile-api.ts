import { request } from './api-client';

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

export async function getUserProfile(userId: string) {
  return request<UserProfile>(`/api/users/${userId}/profile`);
}
