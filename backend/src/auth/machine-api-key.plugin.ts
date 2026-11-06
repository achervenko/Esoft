import { apiKey } from '@better-auth/api-key';

import { MACHINE_KEY_CONFIG } from './machine-api-key.contract';
export function machineApiKeyPlugin() {
  return apiKey({
    configId: MACHINE_KEY_CONFIG,
    references: 'user',
    enableSessionForAPIKeys: false,
    enableMetadata: true,
    maximumNameLength: 100,
    rateLimit: { enabled: true, timeWindow: 60_000, maxRequests: 120 },
    keyExpiration: {
      defaultExpiresIn: 365 * 86400,
      minExpiresIn: 1,
      maxExpiresIn: 365,
    },
    schema: { apikey: { modelName: 'apiKey' } },
  });
}

// Keys and their scopes are administered by the owning server component only.
export const machineKeyDisabledPaths = [
  '/api-key/create',
  '/api-key/get',
  '/api-key/list',
  '/api-key/update',
  '/api-key/delete',
];
