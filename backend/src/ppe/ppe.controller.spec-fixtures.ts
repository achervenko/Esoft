jest.mock('@thallesp/nestjs-better-auth', () => ({
  Session: () => () => undefined,
}));

import type { UserSession } from '@thallesp/nestjs-better-auth';
import type { Auth } from '../auth/auth.config';
import { PpeController } from './ppe.controller';

export type SessionType = UserSession<Auth>;

export const session = (role: string) =>
  ({ user: { id: 'ppe-actor', role } }) as unknown as SessionType;

export const operations: Array<{
  name: string;
  invoke: (controller: PpeController, value: SessionType) => unknown;
}> = [
  { name: 'list employees', invoke: (c, s) => c.listEmployees(s) },
  { name: 'list norms', invoke: (c, s) => c.listNorms({}, s) },
  { name: 'read norm', invoke: (c, s) => c.findNorm(1, s) },
  {
    name: 'read effective norm',
    invoke: (c, s) => c.findEffectiveNorm(1, {}, s),
  },
  { name: 'create norm', invoke: (c, s) => c.createNorm({}, s) },
  {
    name: 'create norm revision',
    invoke: (c, s) => c.createNormRevision(1, {}, s),
  },
  {
    name: 'update future norm',
    invoke: (c, s) => c.updateFutureNorm(1, {}, s),
  },
  { name: 'read employee sizes', invoke: (c, s) => c.findEmployee(1, s) },
  {
    name: 'update employee sizes',
    invoke: (c, s) => c.updateEmployeeSizes(1, { clothingSize: '52' }, s),
  },
  { name: 'list positions', invoke: (c, s) => c.listPositions(s) },
  { name: 'list PPE items', invoke: (c, s) => c.listItems(s) },
  { name: 'read PPE item', invoke: (c, s) => c.findItem(1, s) },
  {
    name: 'create PPE item',
    invoke: (c, s) =>
      c.createItem({ article: 'A', name: 'Boots', unit: 'пары' }, s),
  },
  {
    name: 'update PPE item',
    invoke: (c, s) =>
      c.updateItem(1, { article: 'A', name: 'Boots', unit: 'пары' }, s),
  },
  {
    name: 'change PPE status',
    invoke: (c, s) => c.setItemStatus(1, { isActive: false }, s),
  },
  { name: 'list PPE sizes', invoke: (c, s) => c.listSizes(1, s) },
  {
    name: 'replace PPE size grid',
    invoke: (c, s) => c.replaceSizes(1, { sizes: [] }, s),
  },
  {
    name: 'create PPE size',
    invoke: (c, s) => c.createSize(1, { value: '42' }, s),
  },
  {
    name: 'update PPE size',
    invoke: (c, s) => c.updateSize(1, 2, { value: '43' }, s),
  },
  {
    name: 'change PPE size status',
    invoke: (c, s) => c.setSizeStatus(1, 2, { isActive: false }, s),
  },
];

export function createController() {
  const norms = {
    list: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue({}),
    findEffectiveNorm: jest.fn().mockResolvedValue({}),
    create: jest.fn().mockResolvedValue({}),
    createRevision: jest.fn().mockResolvedValue({}),
    updateFuture: jest.fn().mockResolvedValue({}),
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
