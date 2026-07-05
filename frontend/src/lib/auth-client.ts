import { createAuthClient } from 'better-auth/react';
import { inferAdditionalFields } from 'better-auth/client/plugins';
import { adminClient, usernameClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:3000',
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
