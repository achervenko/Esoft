import { Injectable, type OnModuleInit } from '@nestjs/common';
import type {
  IntegrationConnection,
  IntegrationSystemAdapter,
} from '../integration.contracts';
import {
  createIntegrationHttpClient,
  validateHttpBaseUrl,
} from '../integration-http';
import { IntegrationRegistry } from '../integration-registry';
import { IntegrationFailure } from '../integration-errors';
@Injectable()
export class OneCIntegrationAdapter
  implements IntegrationSystemAdapter, OnModuleInit
{
  readonly systemType = 'ONE_C';
  constructor(private readonly registry: IntegrationRegistry) {}
  onModuleInit() {
    this.registry.registerAdapter(this);
  }
  validateSourceConfig(config: unknown) {
    if (
      !config ||
      typeof config !== 'object' ||
      !('baseUrl' in config) ||
      typeof config.baseUrl !== 'string'
    )
      throw new IntegrationFailure('INTEGRATION_CONFIG_INVALID', false);
    validateHttpBaseUrl(config.baseUrl);
  }
  createHttpClient(connection: IntegrationConnection) {
    return createIntegrationHttpClient(connection);
  }
}
