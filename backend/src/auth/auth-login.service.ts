import { PrismaClient } from '@prisma/client';

type AuthSessionForLogin = {
  userId: string;
  impersonatedBy?: string | null;
};

export class AuthLoginService {
  constructor(private readonly prisma: PrismaClient) {}

  async recordSuccessfulLogin(session: AuthSessionForLogin): Promise<void> {
    if (session.impersonatedBy) {
      return;
    }

    await this.prisma.user.update({
      where: { id: session.userId },
      data: { lastLoginAt: new Date() },
    });
  }
}
