import { Test } from '@nestjs/testing';
import { PrismaModule } from './prisma.module';
import { PrismaService } from './prisma.service';

it('shares Prisma inside a Nest container and isolates separate containers', async () => {
  const first = await Test.createTestingModule({
    imports: [PrismaModule],
  }).compile();
  const second = await Test.createTestingModule({
    imports: [PrismaModule],
  }).compile();
  try {
    expect(first.get(PrismaService)).toBe(first.get(PrismaService));
    expect(first.get(PrismaService)).not.toBe(second.get(PrismaService));
  } finally {
    await first.close();
    await second.close();
  }
});
