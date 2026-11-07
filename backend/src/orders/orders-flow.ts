import { Injectable, type OnModuleInit } from '@nestjs/common';
import { IntegrationRegistry } from '../integrations/integration-registry';
import { IntegrationFailure } from '../integrations/integration-errors';
import { ORDERS_FLOW } from './orders.constants';
import { ordersCollection } from './orders-snapshot';
@Injectable()
export class OrdersFlow implements OnModuleInit {
  readonly flowCode = ORDERS_FLOW;
  readonly name = 'Заказы клиентов 1С';
  readonly owner = 'orders';
  readonly systemTypes = ['ONE_C'];
  readonly configVersions = [1];
  readonly incomingActions: string[] = [];
  constructor(private readonly registry: IntegrationRegistry) {}
  onModuleInit() {
    this.registry.registerFlow(this);
  }
  validateConfig(version: number, config: unknown) {
    if (version !== 1)
      throw new IntegrationFailure('FLOW_CONFIG_UNSUPPORTED', false);
    ordersCollection(config);
  }
  validateEvent(): never {
    throw new IntegrationFailure('ORDERS_PUSH_UNSUPPORTED', false);
  }
  handle(): Promise<void> {
    return Promise.reject(
      new IntegrationFailure('ORDERS_PUSH_UNSUPPORTED', false),
    );
  }
}
