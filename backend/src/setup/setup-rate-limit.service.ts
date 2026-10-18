import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const MAX_ATTEMPTS = 5;
const MAX_KEYS = 4096;
const LOCK_ID = 2026101701;

@Injectable()
export class SetupRateLimitService {
  constructor(private readonly prisma: PrismaService) {}

  async consume(ip: string | undefined | null): Promise<void> {
    if (!ip || !isIP(ip)) this.throwRateLimited();
    // Canonicalize IPv6 and IPv4-mapped IPv6 before deriving the key.
    const canonical = ip.includes(':')
      ? new URL(`http://[${ip}]/`).hostname.slice(1, -1)
      : ip;
    const normalized = canonical.startsWith('::ffff:')
      ? canonical
          .slice(7)
          .split(':')
          .map((part) => parseInt(part, 16))
          .flatMap((part) => [part >> 8, part & 255])
          .join('.')
      : canonical;
    const key = createHash('sha256').update(normalized).digest('hex');
    // A separate transaction persists attempts even when DTO validation or
    // administrator creation subsequently fails. All instances use this lock.
    const allowed = await this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT 1 FROM (SELECT pg_advisory_xact_lock(${LOCK_ID})) AS rate_lock`;
        await tx.$executeRaw`DELETE FROM setup_rate_limits WHERE reset_at <= clock_timestamp()`;
        const current = await tx.$queryRaw<Array<{ attempts: number }>>`
        SELECT attempts FROM setup_rate_limits WHERE key = ${key}
      `;
        if (current.length) {
          await tx.$executeRaw`
          UPDATE setup_rate_limits SET attempts = LEAST(attempts + 1, ${MAX_ATTEMPTS + 1})
          WHERE key = ${key}
        `;
          return current[0].attempts < MAX_ATTEMPTS;
        }
        const [capacity] = await tx.$queryRaw<Array<{ count: number }>>`
        SELECT count(*)::integer AS count FROM setup_rate_limits
      `;
        if (capacity.count >= MAX_KEYS) return false;
        await tx.$executeRaw`
        INSERT INTO setup_rate_limits(key, attempts, reset_at)
        VALUES (${key}, 1, clock_timestamp() + interval '10 minutes')
      `;
        return true;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
    if (!allowed) this.throwRateLimited();
  }

  private throwRateLimited(): never {
    throw new HttpException(
      {
        code: 'SETUP_RATE_LIMITED',
        message: 'Слишком много попыток. Попробуйте позже.',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
