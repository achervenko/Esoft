import { IntegrationRegistry } from './integration-registry';
jest.mock('@thallesp/nestjs-better-auth', () => {
  const common =
    jest.requireActual<typeof import('@nestjs/common')>('@nestjs/common');
  return {
    AllowAnonymous: () => common.SetMetadata('PUBLIC', true),
    Session: common.createParamDecorator(
      (_data: unknown, ctx: import('@nestjs/common').ExecutionContext) =>
        ctx.switchToHttp().getRequest<{ session: unknown }>().session,
    ),
  };
});

import { Test } from '@nestjs/testing';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import {
  AUTHENTICATE_REQUEST,
  PermissionsGuard,
} from '../auth/permissions.guard';
import { ACTIVE_MODULES } from '../config/active-modules.module';
import type { Request } from 'express';
import type { INestApplication } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller';
import { IntegrationSourcesService } from './integration-sources.service';
import { IntegrationEventsService } from './integration-events.service';
import { IntegrationKeysService } from './integration-keys.service';
import * as policy from '../auth/permission-policy';
describe('Receipt integration HTTP permissions', () => {
  let app: INestApplication;
  let base: string;
  async function request(
    op: { method: string; path: string },
    role?: string,
    authorization?: string,
  ) {
    return fetch(base + op.path, {
      method: op.method,
      headers: {
        'content-type': 'application/json',
        ...(role ? { 'x-role': role } : {}),
        ...(authorization ? { authorization } : {}),
      },
      ...(['POST', 'PUT'].includes(op.method) ? { body: '{}' } : {}),
    });
  }
  const sources = {
    create: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
    configureFlow: jest.fn().mockResolvedValue({}),
    list: jest.fn().mockResolvedValue([]),
  };
  const events = {
    accept: jest.fn().mockResolvedValue({ status: 'PENDING' }),
    list: jest.fn().mockResolvedValue({ items: [] }),
    retry: jest.fn().mockResolvedValue({}),
    history: jest.fn().mockResolvedValue({}),
  };
  const operations = [
    { method: 'GET', path: '/api/integrations/sources' },
    { method: 'POST', path: '/api/integrations/sources' },
    { method: 'PATCH', path: '/api/integrations/sources/test' },
    { method: 'PUT', path: '/api/integrations/sources/test/flows/test.flow' },
    { method: 'GET', path: '/api/integrations/flows' },
    { method: 'GET', path: '/api/integrations/sources/test/keys' },
    { method: 'POST', path: '/api/integrations/sources/test/keys' },
    { method: 'POST', path: '/api/integrations/sources/test/keys/1/revoke' },
    { method: 'GET', path: '/api/integrations/events' },
    { method: 'GET', path: '/api/integrations/events/1' },
    { method: 'POST', path: '/api/integrations/events/1/retry' },
  ];
  beforeAll(async () => {
    const fixture = await Test.createTestingModule({
      controllers: [IntegrationsController],
      providers: [
        {
          provide: IntegrationSourcesService,
          useValue: sources,
        },
        { provide: IntegrationEventsService, useValue: events },
        {
          provide: IntegrationKeysService,
          useValue: {
            create: jest.fn().mockResolvedValue({}),
            list: jest.fn().mockResolvedValue([]),
            revoke: jest.fn().mockResolvedValue({}),
          },
        },
        { provide: IntegrationRegistry, useValue: { listFlows: () => [] } },
        { provide: ACTIVE_MODULES, useValue: [] },
        {
          provide: AUTHENTICATE_REQUEST,
          useFactory: (reflector: Reflector) => (ctx: ExecutionContext) => {
            if (reflector.get('PUBLIC', ctx.getHandler()) === true)
              return Promise.resolve(true);
            const req = ctx
              .switchToHttp()
              .getRequest<Request & { session: unknown }>();
            const role = req.headers['x-role'];
            if (typeof role !== 'string') throw new UnauthorizedException();
            req.session = { user: { id: 'actor', role } };
            return Promise.resolve(true);
          },
          inject: [Reflector],
        },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    }).compile();
    app = fixture.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
  });
  afterAll(async () => {
    await app.close();
  });
  afterEach(() => jest.restoreAllMocks());
  beforeEach(() => jest.clearAllMocks());
  it('accepts source authorization without a user session', async () => {
    const response = await request(
      {
        method: 'POST',
        path: '/api/integrations/sources/test/flows/test.flow/events',
      },
      undefined,
      'Bearer source-token',
    );
    expect(response.status).toBe(202);
    expect(events.accept).toHaveBeenCalledWith(
      'test',
      'test.flow',
      expect.anything(),
      'Bearer source-token',
    );
  });
  it.each(['storekeeper', 'operator', 'engineer', 'auditor'])(
    'denies integration access for %s',
    async (role) => {
      for (const op of operations)
        expect((await request(op, role)).status).toBe(403);
      expect(events.accept).not.toHaveBeenCalled();
      expect(sources.create).not.toHaveBeenCalled();
    },
  );
  it('does not confuse stock read with integration administration', async () => {
    jest
      .spyOn(policy, 'getUserPermissions')
      .mockReturnValue(['warehouse.stock.read']);
    for (const op of operations)
      expect((await request(op, 'admin')).status).toBe(403);
  });
  it('does not let source credentials authorize administrative endpoints', async () => {
    for (const op of operations)
      expect((await request(op, undefined, 'Bearer source-token')).status).toBe(
        401,
      );
  });
  it('propagates source authentication failure even for a logged-in admin', async () => {
    events.accept.mockRejectedValueOnce(
      new UnauthorizedException({
        code: 'WAREHOUSE_RECEIPT_SOURCE_UNAUTHORIZED',
      }),
    );
    const response = await request(
      {
        method: 'POST',
        path: '/api/integrations/sources/test/flows/test.flow/events',
      },
      'admin',
    );
    expect(response.status).toBe(401);
    expect(events.accept).toHaveBeenCalledWith(
      'test',
      'test.flow',
      {},
      undefined,
    );
  });
});
