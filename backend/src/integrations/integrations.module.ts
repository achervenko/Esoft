import { Module } from '@nestjs/common';
import { IntegrationRegistry } from './integration-registry';
import { OneCIntegrationAdapter } from './adapters/one-c.adapter';
@Module({
  providers: [IntegrationRegistry, OneCIntegrationAdapter],
  exports: [IntegrationRegistry],
})
export class IntegrationsModule {}
