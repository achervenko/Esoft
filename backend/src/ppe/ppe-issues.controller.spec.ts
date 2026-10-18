jest.mock('@thallesp/nestjs-better-auth', () => ({
  Session: () => () => undefined,
}));
import type { UserSession } from '@thallesp/nestjs-better-auth';
import type { Auth } from '../auth/auth.config';
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
describe('PPE issue controller arguments', () => {
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
