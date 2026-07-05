import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type IdentityTarget = {
  columnName: string;
  tableName: string;
};

@Injectable()
export class IdentityNumberingService {
  constructor(private readonly prisma: PrismaService) {}

  async getNextId(target: IdentityTarget) {
    const [result] = await this.prisma.$queryRaw<{ nextId: number }[]>(
      Prisma.sql`SELECT app_next_identity_id(${target.tableName}::regclass, ${target.columnName}) AS "nextId"`,
    );

    return Number(result.nextId);
  }

  async syncSequence(target: IdentityTarget) {
    await this.prisma.$executeRaw(
      Prisma.sql`SELECT app_sync_identity_sequence(${target.tableName}::regclass, ${target.columnName})`,
    );
  }
}
