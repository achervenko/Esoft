import { Test } from '@nestjs/testing';
import type { Request, Response } from 'express';
import { PrismaModule } from './prisma/prisma.module';
import { PrismaService, prismaService } from './prisma/prisma.service';
import {
  s3ClientProvider,
  StorageS3Client,
} from './storage/s3/s3-client.provider';
import { S3_CLIENT, STORAGE_CONFIG } from './storage/storage.tokens';

describe('application shutdown', () => {
  it('finishes an active HTTP request before releasing Prisma and S3', async () => {
    const connect = jest.spyOn(prismaService, '$connect').mockResolvedValue();
    const disconnect = jest
      .spyOn(prismaService, '$disconnect')
      .mockResolvedValue();
    let releaseRequest!: () => void;
    let markStarted!: () => void;
    const requestStarted = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const requestReleased = new Promise<void>((resolve) => {
      releaseRequest = resolve;
    });
    const module = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [
        s3ClientProvider,
        {
          provide: STORAGE_CONFIG,
          useValue: {
            accessKey: 'test',
            secretKey: 'test',
            endpoint: 'http://127.0.0.1:9000',
            forcePathStyle: true,
            region: 'us-east-1',
          },
        },
      ],
    }).compile();
    const app = module.createNestApplication({ logger: false });
    const s3 = app.get<StorageS3Client>(S3_CLIENT);
    const destroy = jest.spyOn(s3, 'destroy');
    let closing: Promise<void> | undefined;
    app.use((_req: Request, res: Response) => {
      markStarted();
      void requestReleased.then(() => {
        res.end('completed');
      });
    });

    try {
      expect(app.get(PrismaService)).toBe(prismaService);
      await app.listen(0, '127.0.0.1');
      expect(connect).toHaveBeenCalledTimes(1);
      const response = fetch(await app.getUrl());
      await requestStarted;
      closing = app.close();
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(disconnect).not.toHaveBeenCalled();
      expect(destroy).not.toHaveBeenCalled();

      releaseRequest();
      expect(await (await response).text()).toBe('completed');
      await closing;
      expect(disconnect).toHaveBeenCalledTimes(1);
      expect(destroy).toHaveBeenCalledTimes(1);
    } finally {
      releaseRequest();
      await (closing ?? app.close());
      jest.restoreAllMocks();
    }
  });
});
