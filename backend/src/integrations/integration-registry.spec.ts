import { Test } from '@nestjs/testing';
import { IntegrationsModule } from './integrations.module';
import { IntegrationRegistry } from './integration-registry';
import type { IntegrationFlowHandler } from './integration.contracts';

function handler(code: string) {
  return {
    flowCode: code,
    name: code,
    owner: 'test',
    systemTypes: ['ONE_C'],
    configVersions: [1],
    incomingActions: ['event:create'],
    validateConfig: jest.fn(),
    validateEvent: jest.fn(),
    handle: jest.fn().mockResolvedValue(undefined),
  } satisfies IntegrationFlowHandler;
}
it('registers multiple independent flows without changing the core and rejects unsupported capabilities', async () => {
  const fixture = await Test.createTestingModule({
    imports: [IntegrationsModule],
  }).compile();
  await fixture.init();
  try {
    const registry = fixture.get(IntegrationRegistry);
    expect(registry.adapter('ONE_C').systemType).toBe('ONE_C');
    const first = handler('example.first'),
      second = handler('example.second');
    registry.registerFlow(first);
    registry.registerFlow(second);
    expect(registry.validateFlow('example.second', 'ONE_C', 1, {})).toBe(
      second,
    );
    expect(registry.listFlows().map((f) => f.flowCode)).toEqual([
      'example.first',
      'example.second',
    ]);
    const context = {
      sourceCode: 'another-source',
      actorUserId: 'system',
      event: {
        eventId: 'event',
        objectId: '55',
        type: 'UPDATE',
        version: '10',
      },
      configVersion: 1,
      config: {},
      client: { getJson: jest.fn() },
    };
    await registry.flow('example.second').handle(context);
    expect(second.handle).toHaveBeenCalledWith(context);
    expect(first.handle).not.toHaveBeenCalled();
    expect(() => registry.registerFlow(first)).toThrow();
    expect(() =>
      registry.validateFlow('example.first', 'OTHER', 1, {}),
    ).toThrow('FLOW_SYSTEM_UNSUPPORTED');
    expect(() =>
      registry.validateFlow('example.first', 'ONE_C', 2, {}),
    ).toThrow('FLOW_CONFIG_UNSUPPORTED');
    expect(() =>
      registry.validateCapabilities('example.first', ['event:create']),
    ).not.toThrow();
    expect(() =>
      registry.validateCapabilities('example.first', ['users:manage']),
    ).toThrow('FLOW_CAPABILITY_INVALID');
    expect(() => registry.validateCapabilities('example.first', [])).toThrow();
    expect(() => registry.flow('disabled.module')).toThrow(
      'HANDLER_UNAVAILABLE',
    );
  } finally {
    await fixture.close();
  }
});
