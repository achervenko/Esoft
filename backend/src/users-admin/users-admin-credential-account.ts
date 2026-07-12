import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import type { Prisma } from '@prisma/client';

export const CREDENTIAL_PROVIDER_ID = 'credential';

export function hashUserPassword(password: string) {
  return hashPassword(password);
}

export function createCredentialAccount(
  tx: Prisma.TransactionClient,
  userId: string,
  passwordHash: string,
) {
  return tx.account.create({
    data: {
      accountId: userId,
      id: randomUUID(),
      password: passwordHash,
      providerId: CREDENTIAL_PROVIDER_ID,
      userId,
    },
  });
}
