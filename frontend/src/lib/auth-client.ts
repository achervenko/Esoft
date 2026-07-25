import { createAuthClient } from 'better-auth/react';
import { adminClient, usernameClient } from 'better-auth/client/plugins';
import { API_URL } from '../shared/api/api-config';

export const authClient = createAuthClient({
  baseURL: API_URL,
  fetchOptions: {
    credentials: 'include',
  },
  plugins: [
    usernameClient(),
    adminClient(),
  ],
});
