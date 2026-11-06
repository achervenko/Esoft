import { Injectable, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { StorageModule } from './storage.module';
import { StorageStagedUploadService } from './storage-staged-upload.service';
import { S3_CLIENT, STORAGE_CONFIG } from './storage.tokens';

@Injectable()
class StorageConsumer {
  constructor(readonly uploads: StorageStagedUploadService) {}
}
@Module({ imports: [StorageModule], providers: [StorageConsumer] })
class FirstConsumerModule {}
@Module({ imports: [StorageModule], providers: [StorageConsumer] })
class SecondConsumerModule {}

it('shares storage between explicit imports without exposing it globally', async () => {
  const create = () =>
    Test.createTestingModule({
      imports: [FirstConsumerModule, SecondConsumerModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(STORAGE_CONFIG)
      .useValue({})
      .overrideProvider(S3_CLIENT)
      .useValue({});
  const fixture = await create().compile();
  try {
    const first = fixture
      .select(FirstConsumerModule)
      .get(StorageConsumer, { strict: true });
    const second = fixture
      .select(SecondConsumerModule)
      .get(StorageConsumer, { strict: true });
    expect(first.uploads).toBeInstanceOf(StorageStagedUploadService);
    expect(first.uploads).toBe(second.uploads);
  } finally {
    await fixture.close();
  }
  await expect(
    Test.createTestingModule({
      imports: [FirstConsumerModule],
      providers: [StorageConsumer],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(STORAGE_CONFIG)
      .useValue({})
      .overrideProvider(S3_CLIENT)
      .useValue({})
      .compile(),
  ).rejects.toThrow(/StorageConsumer/);
});
