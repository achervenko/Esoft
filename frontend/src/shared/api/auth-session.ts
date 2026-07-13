import { authClient } from '../../lib/auth-client';
import {
  getUserProfile,
  type EmployeeProfile,
  type UserPhoto,
} from './user-profile-api';

export type SessionUser = {
  displayUsername?: string | null;
  email?: string | null;
  employee?: EmployeeProfile | null;
  id?: string;
  name?: string | null;
  photo?: UserPhoto | null;
  role?: string | null;
  username?: string | null;
};

const SESSION_RETRY_ATTEMPTS = 8;
const SESSION_RETRY_DELAY_MS = 150;

function delay(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export async function getAuthenticatedUser() {
  const response = await authClient.getSession();

  if (!response.data?.session) {
    return null;
  }

  const sessionUser = (response.data.user ?? null) as SessionUser | null;

  if (!sessionUser?.id) {
    return sessionUser;
  }

  try {
    return await getUserProfile(sessionUser.id);
  } catch {
    return sessionUser;
  }
}

export async function waitForAuthenticatedUser() {
  for (let attempt = 0; attempt < SESSION_RETRY_ATTEMPTS; attempt += 1) {
    const user = await getAuthenticatedUser();

    if (user) {
      return user;
    }

    await delay(SESSION_RETRY_DELAY_MS);
  }

  throw new Error('Не удалось подтвердить сессию пользователя.');
}
