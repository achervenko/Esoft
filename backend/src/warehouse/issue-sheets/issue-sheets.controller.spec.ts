jest.mock('@thallesp/nestjs-better-auth', () => {
  const common =
    jest.requireActual<typeof import('@nestjs/common')>('@nestjs/common');
  return {
    Session: common.createParamDecorator(
      (_data: unknown, ctx: import('@nestjs/common').ExecutionContext) =>
        ctx.switchToHttp().getRequest<{ session: unknown }>().session,
    ),
  };
});
import { METHOD_METADATA } from '@nestjs/common/constants';
import {
  createPermissionsHttpFixture,
  type HttpOperation,
} from '../../auth/permissions-http.fixture';
import { REQUIRED_PERMISSION } from '../../auth/require-permission';
import { WarehouseIssueSheetsController } from './issue-sheets.controller';
import { WarehouseIssueSheetsService } from './issue-sheets.service';
import { WarehouseIssueSheetsQueryService } from './issue-sheets-query.service';

const root = '/api/warehouse/issue-sheets';
const operations: HttpOperation[] = [
  { method: 'GET', path: root },
  { method: 'GET', path: root + '/1' },
  { method: 'GET', path: root + '/1/lines' },
  { method: 'POST', path: root },
  { method: 'POST', path: root + '/1/lines' },
  { method: 'PATCH', path: root + '/1/lines/1' },
  { method: 'DELETE', path: root + '/1/lines/1' },
  ...['ready', 'finalize', 'cancel'].map((action) => ({
    method: 'POST',
    path: root + '/1/' + action,
    body: {},
  })),
];
describe('IssueSheets permissions', () => {
  let http: Awaited<ReturnType<typeof createPermissionsHttpFixture>>;
  const sheets = Object.fromEntries(
    [
      'create',
      'addLine',
      'updateLine',
      'removeLine',
      'markReady',
      'finalize',
      'cancel',
    ].map((key) => [key, jest.fn().mockResolvedValue({})]),
  );
  const queries = {
    list: jest.fn().mockResolvedValue({}),
    findOne: jest.fn().mockResolvedValue({}),
    lines: jest.fn().mockResolvedValue({}),
  };
  beforeAll(async () => {
    http = await createPermissionsHttpFixture({
      controllers: [WarehouseIssueSheetsController],
      providers: [
        { provide: WarehouseIssueSheetsService, useValue: sheets },
        { provide: WarehouseIssueSheetsQueryService, useValue: queries },
      ],
    });
    http.modules.push('warehouse');
  });
  afterAll(async () => {
    await http?.app.close();
  });
  beforeEach(() => jest.clearAllMocks());
  it('declares an explicit permission for every handler', () => {
    const handlers = Object.getOwnPropertyNames(
      WarehouseIssueSheetsController.prototype,
    )
      .map(
        (name) =>
          Object.getOwnPropertyDescriptor(
            WarehouseIssueSheetsController.prototype,
            name,
          )?.value as unknown,
      )
      .filter(
        (handler): handler is (...args: unknown[]) => unknown =>
          typeof handler === 'function' &&
          Reflect.hasMetadata(METHOD_METADATA, handler),
      );
    expect(handlers).toHaveLength(operations.length);
    for (const handler of handlers)
      expect(Reflect.getMetadata(REQUIRED_PERMISSION, handler)).toBe(
        'warehouse.issue-sheets.manage',
      );
  });
  it.each(['admin', 'storekeeper', 'engineer,storekeeper'])(
    'allows authorized role %s',
    async (role) => {
      for (const operation of operations)
        expect((await http.request(operation, role)).status).toBeLessThan(300);
    },
  );
  it.each([
    'engineer',
    'ppe_specialist',
    'accounting_specialist',
    'operator',
    'unknown',
  ])('rejects unauthorized role %s before service invocation', async (role) => {
    for (const operation of operations)
      expect((await http.request(operation, role)).status).toBe(403);
    for (const mock of [...Object.values(sheets), ...Object.values(queries)])
      expect(mock).not.toHaveBeenCalled();
  });
  it('requires an authenticated session', async () => {
    expect((await http.request(operations[0])).status).toBe(401);
  });
  it('does not accept a client-specified final status', async () => {
    expect(
      (
        await http.request(
          {
            method: 'POST',
            path: root + '/1/finalize',
            body: { status: 'PROCESSED' },
          },
          'admin',
        )
      ).status,
    ).toBe(400);
    expect(sheets.finalize).not.toHaveBeenCalled();
  });
});
