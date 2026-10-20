jest.mock('@thallesp/nestjs-better-auth', () => ({
  Session: () => () => undefined,
}));

import type { UserSession } from '@thallesp/nestjs-better-auth';
import type { Auth } from '../auth/auth.config';
import { PpeController } from './ppe.controller';

export type SessionType = UserSession<Auth>;

export const session = (role: string) =>
  ({ user: { id: 'ppe-actor', role } }) as unknown as SessionType;

export function createController() {
  const norms = {
    list: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue({}),
    findEffectiveNorm: jest.fn().mockResolvedValue({}),
    create: jest.fn().mockResolvedValue({}),
    createRevision: jest.fn().mockResolvedValue({}),
    updateFuture: jest.fn().mockResolvedValue({}),
    end: jest.fn().mockResolvedValue({}),
    deleteFuture: jest.fn().mockResolvedValue({}),
  };
  const catalog = {
    listItems: jest.fn().mockResolvedValue([]),
    findItem: jest.fn().mockResolvedValue({}),
    createItem: jest.fn().mockResolvedValue({}),
    updateItem: jest.fn().mockResolvedValue({}),
    setItemStatus: jest.fn().mockResolvedValue({}),
    listSizes: jest.fn().mockResolvedValue([]),
    replaceSizes: jest.fn().mockResolvedValue([]),
    createSize: jest.fn().mockResolvedValue({}),
    updateSize: jest.fn().mockResolvedValue({}),
    setSizeStatus: jest.fn().mockResolvedValue({}),
  };
  const employees = {
    list: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue({}),
    updateSizes: jest.fn().mockResolvedValue({}),
    listPositions: jest.fn().mockResolvedValue([]),
  };
  return {
    controller: new PpeController(
      catalog as never,
      employees as never,
      norms as never,
    ),
    catalog,
    employees,
    norms,
  };
}
