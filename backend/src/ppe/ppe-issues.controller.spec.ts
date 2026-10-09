jest.mock('@thallesp/nestjs-better-auth', () => ({
  Session: () => () => undefined,
}));
import { ForbiddenException } from '@nestjs/common';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import type { Auth } from '../auth/auth.config';
import * as permissions from '../auth/role-permissions';
import { PpeIssuesController } from './ppe-issues.controller';

type SessionType = UserSession<Auth>;
const session = (role: string) =>
  ({ user: { id: 'real-actor', role } }) as unknown as SessionType;
function fixture() {
  const issues = {
    recommendSize: jest.fn().mockResolvedValue({}),
    plan: jest.fn().mockResolvedValue({}),
    list: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue({}),
    createRegular: jest.fn().mockResolvedValue([]),
    createExtra: jest.fn().mockResolvedValue([]),
    cancel: jest.fn().mockResolvedValue({}),
  };
  return { controller: new PpeIssuesController(issues as never), issues };
}
const operations = [
  {
    name: 'size recommendation',
    permission: 'assertCanReadPpe',
    invoke: (c: PpeIssuesController, s: SessionType) =>
      c.recommendSize(1, 2, s),
  },
  {
    name: 'plan',
    permission: 'assertCanReadPpe',
    invoke: (c: PpeIssuesController, s: SessionType) => c.plan(1, {}, s),
  },
  {
    name: 'list',
    permission: 'assertCanReadPpe',
    invoke: (c: PpeIssuesController, s: SessionType) => c.list({}, s),
  },
  {
    name: 'find',
    permission: 'assertCanReadPpe',
    invoke: (c: PpeIssuesController, s: SessionType) => c.findOne(1, s),
  },
  {
    name: 'regular',
    permission: 'assertCanIssuePpe',
    invoke: (c: PpeIssuesController, s: SessionType) => c.createRegular({}, s),
  },
  {
    name: 'extra',
    permission: 'assertCanIssuePpe',
    invoke: (c: PpeIssuesController, s: SessionType) => c.createExtra({}, s),
  },
  {
    name: 'cancel',
    permission: 'assertCanIssuePpe',
    invoke: (c: PpeIssuesController, s: SessionType) => c.cancel(1, {}, s),
  },
] as const;
describe.each(['admin', 'ppe_specialist', 'accounting_specialist'])(
  'PPE issues role %s',
  (role) => {
    it.each(operations)('allows $name', async ({ invoke }) => {
      if (
        role === 'ppe_specialist' &&
        operations.find((op) => op.invoke === invoke)?.permission ===
          'assertCanIssuePpe'
      ) {
        const { controller, issues } = fixture();
        expect(() => invoke(controller, session(role))).toThrow(
          ForbiddenException,
        );
        for (const operation of Object.values(issues))
          expect(operation).not.toHaveBeenCalled();
        return;
      }
      await expect(
        Promise.resolve(invoke(fixture().controller, session(role))),
      ).resolves.toBeDefined();
    });
  },
);
describe.each(['operator', 'engineer', 'chief_engineer', 'auditor', 'unknown'])(
  'PPE issues forbidden role %s',
  (role) => {
    it.each(operations)('rejects $name before service', ({ invoke }) => {
      const { controller, issues } = fixture();
      expect(() => invoke(controller, session(role))).toThrow(
        ForbiddenException,
      );
      for (const operation of Object.values(issues))
        expect(operation).not.toHaveBeenCalled();
    });
  },
);
describe('PPE issue controller permission bindings', () => {
  afterEach(() => jest.restoreAllMocks());
  it.each(operations)(
    '$name uses precisely $permission',
    async ({ permission, invoke }) => {
      const read = jest
        .spyOn(permissions, 'assertCanReadPpe')
        .mockImplementation(() => undefined);
      const issue = jest
        .spyOn(permissions, 'assertCanIssuePpe')
        .mockImplementation(() => undefined);
      await invoke(fixture().controller, session('test-role'));
      expect(
        permission === 'assertCanReadPpe' ? read : issue,
      ).toHaveBeenCalledWith('test-role');
      expect(
        permission === 'assertCanReadPpe' ? issue : read,
      ).not.toHaveBeenCalled();
    },
  );
  it.each(operations)(
    '$name stops on permission denial',
    ({ permission, invoke }) => {
      jest
        .spyOn(permissions, 'assertCanReadPpe')
        .mockImplementation(() => undefined);
      jest
        .spyOn(permissions, 'assertCanIssuePpe')
        .mockImplementation(() => undefined);
      jest.spyOn(permissions, permission).mockImplementation(() => {
        throw new ForbiddenException();
      });
      const { controller, issues } = fixture();
      expect(() => invoke(controller, session('test-role'))).toThrow(
        ForbiddenException,
      );
      for (const operation of Object.values(issues))
        expect(operation).not.toHaveBeenCalled();
    },
  );
  it('routes regular and extra to distinct service methods with the session actor', async () => {
    const { controller, issues } = fixture();
    const payload = { employeeId: 1, items: [] };
    await controller.createRegular(payload, session('admin'));
    expect(issues.createRegular).toHaveBeenCalledWith(payload, {
      userId: 'real-actor',
      role: 'admin',
    });
    expect(issues.createExtra).not.toHaveBeenCalled();
    await controller.createExtra(payload, session('admin'));
    expect(issues.createExtra).toHaveBeenCalledWith(payload, {
      userId: 'real-actor',
      role: 'admin',
    });
    await controller.cancel(1, { reason: 'wrong' }, session('admin'));
    expect(issues.cancel).toHaveBeenCalledWith(
      1,
      { reason: 'wrong' },
      'real-actor',
    );
  });
});
