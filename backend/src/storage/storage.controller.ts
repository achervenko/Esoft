import { Controller, Get } from '@nestjs/common';
import { StorageObjectService } from './storage-object.service';

@Controller('api/storage')
export class StorageController {
  constructor(private readonly storageObjectService: StorageObjectService) {}

  @Get('health')
  async checkHealth() {
    await this.storageObjectService.assertBucketAvailable();

    return {
      status: 'ok',
    };
  }
}
