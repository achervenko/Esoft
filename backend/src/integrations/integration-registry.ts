import { Injectable } from '@nestjs/common';
import type {
  IntegrationFlowHandler,
  IntegrationSystemAdapter,
} from './integration.contracts';
import { IntegrationFailure } from './integration-errors';

@Injectable()
export class IntegrationRegistry {
  private readonly adapters = new Map<string, IntegrationSystemAdapter>();
  private readonly flows = new Map<string, IntegrationFlowHandler>();
  registerAdapter(adapter: IntegrationSystemAdapter) {
    if (
      !/^[A-Z][A-Z0-9_]{0,49}$/.test(adapter.systemType) ||
      this.adapters.has(adapter.systemType)
    )
      throw new Error('Invalid or duplicate integration system adapter.');
    this.adapters.set(adapter.systemType, adapter);
  }
  registerFlow(handler: IntegrationFlowHandler) {
    if (
      !/^[a-z][a-z0-9_.-]{0,99}$/.test(handler.flowCode) ||
      this.flows.has(handler.flowCode) ||
      !handler.owner ||
      !handler.name ||
      !handler.systemTypes.length ||
      !handler.configVersions.length ||
      new Set(handler.configVersions).size !== handler.configVersions.length ||
      handler.configVersions.some((v) => !Number.isSafeInteger(v) || v < 1) ||
      new Set(handler.incomingActions).size !==
        handler.incomingActions.length ||
      handler.incomingActions.some(
        (a) => !/^[a-z][a-z0-9_-]*:[a-z][a-z0-9_-]*$/.test(a),
      )
    )
      throw new Error('Invalid or duplicate integration flow registration.');
    this.flows.set(handler.flowCode, handler);
  }
  adapter(systemType: string) {
    const adapter = this.adapters.get(systemType);
    if (!adapter) throw new IntegrationFailure('ADAPTER_UNAVAILABLE', true);
    return adapter;
  }
  findFlow(code: string) {
    return this.flows.get(code);
  }
  flow(code: string) {
    const handler = this.flows.get(code);
    if (!handler) throw new IntegrationFailure('HANDLER_UNAVAILABLE', true);
    return handler;
  }
  validateFlow(
    code: string,
    systemType: string,
    version: number,
    config: unknown,
  ) {
    const handler = this.flow(code);
    if (!handler.systemTypes.includes(systemType))
      throw new IntegrationFailure('FLOW_SYSTEM_UNSUPPORTED', false);
    if (!handler.configVersions.includes(version))
      throw new IntegrationFailure('FLOW_CONFIG_UNSUPPORTED', true);
    handler.validateConfig(version, config);
    return handler;
  }
  validateCapabilities(code: string, actions: readonly string[]) {
    const handler = this.flow(code);
    if (
      !actions.length ||
      new Set(actions).size !== actions.length ||
      actions.some((action) => !handler.incomingActions.includes(action))
    )
      throw new IntegrationFailure('FLOW_CAPABILITY_INVALID', false);
  }
  listFlows() {
    return [...this.flows.values()].map((h) => ({
      flowCode: h.flowCode,
      name: h.name,
      owner: h.owner,
      systemTypes: [...h.systemTypes],
      configVersions: [...h.configVersions],
      incomingActions: [...h.incomingActions],
    }));
  }
}
