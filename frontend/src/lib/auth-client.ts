import { createAuthClient } from 'better-auth/react';
import { inferAdditionalFields } from 'better-auth/client/plugins';
import { adminClient, usernameClient } from 'better-auth/client/plugins';

const API_URL = import.meta.env.VITE_API_URL || undefined;

export const authClient = createAuthClient({
  baseURL: API_URL,
  fetchOptions: {
    credentials: 'include',
  },
  plugins: [
    usernameClient(),
    adminClient(),
    inferAdditionalFields({
      user: {
        lastName: {
          type: 'string',
          required: false,
        },
        firstName: {
          type: 'string',
          required: false,
        },
        middleName: {
          type: 'string',
          required: false,
        },
        position: {
          type: 'string',
          required: false,
        },
      },
    }),
  ],
});
