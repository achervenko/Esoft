import { createAuthClient } from 'better-auth/react';
import { adminClient, usernameClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:3000',
  plugins: [usernameClient(), adminClient()],
});
