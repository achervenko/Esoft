import {
  ExecutionContext,
  UnauthorizedException,
  type ModuleMetadata,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import { AUTHENTICATE_REQUEST, PermissionsGuard } from './permissions.guard';
import { ACTIVE_MODULES } from '../config/active-modules.module';

type FixtureRequest = Request & {
  session?: { user: { id: string; role: string } };
};
export type HttpOperation = {
  method: string;
  path: string;
  upload?: boolean;
  body?: unknown;
};
export const mutationPayload = { name: 'Test', isActive: false, banned: true };

export async function createPermissionsHttpFixture(metadata: ModuleMetadata) {
  const modules: string[] = [];
  const fixture = await Test.createTestingModule({
    ...metadata,
    providers: [
      ...(metadata.providers ?? []),
      { provide: ACTIVE_MODULES, useValue: modules },
      {
        provide: AUTHENTICATE_REQUEST,
        useValue: (context: ExecutionContext) => {
          const request = context.switchToHttp().getRequest<FixtureRequest>();
          const role = request.headers['x-role'];
          if (typeof role !== 'string') throw new UnauthorizedException();
          request.session = { user: { id: 'actor', role } };
          return Promise.resolve(true);
        },
      },
      { provide: APP_GUARD, useClass: PermissionsGuard },
    ],
  }).compile();
  const app = fixture.createNestApplication({ logger: false });
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  return {
    app,
    modules,
    request(operation: HttpOperation, role?: string) {
      let body: BodyInit | undefined;
      if (operation.upload) {
        const form = new FormData();
        form.set('file', new Blob(['test'], { type: 'image/png' }), 'test.png');
        body = form;
      } else if (!['GET', 'DELETE'].includes(operation.method)) {
        body = JSON.stringify(
          operation.body === undefined ? mutationPayload : operation.body,
        );
      } else if (operation.body !== undefined) {
        body = JSON.stringify(operation.body);
      }
      const path = operation.path
        .replace(/:userId|:entityType/g, 'target')
        .replace(/:\w+/g, '1');
      return fetch(base + path, {
        method: operation.method,
        headers: {
          ...(role === undefined ? {} : { 'x-role': role }),
          ...(operation.upload ? {} : { 'content-type': 'application/json' }),
        },
        body,
      });
    },
  };
}
