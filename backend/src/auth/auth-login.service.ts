import { PrismaClient } from '@prisma/client';

type AuthSessionForLogin = {
  userId: string;
};

export class AuthLoginService {
  constructor(private readonly prisma: PrismaClient) {}

  async recordSuccessfulLogin(session: AuthSessionForLogin): Promise<void> {
    await this.prisma.user.update({
      where: { id: session.userId },
      data: { lastLoginAt: new Date() },
    });
  }
}
