jest.mock('@thallesp/nestjs-better-auth', () => ({
  AllowAnonymous: () => () => undefined,
}));
jest.mock('./setup.service', () => ({ SetupService: class {} }));
jest.mock('./setup-rate-limit.service', () => ({
  SetupRateLimitService: class {},
}));
jest.mock('../config/root-environment', () => ({ loadRootConfig: () => ({}) }));
jest.mock('../config/frontend-origins', () => ({
  getFrontendOrigins: () => ['http://localhost:5173'],
}));

import type { Request } from 'express';
import { SetupController } from './setup.controller';

const payload = {
  username: 'admin',
  email: 'admin@example.test',
  password: 'Secure1234',
  employee: { lastName: 'Иванов', firstName: 'Иван', middleName: null },
};
function fixture(origin = 'http://localhost:5173') {
  const service = {
    createInitialAdmin: jest.fn().mockResolvedValue({ ok: true }),
  };
  const limiter = { consume: jest.fn().mockResolvedValue(undefined) };
  const request = {
    ip: '192.0.2.1',
    socket: { remoteAddress: '127.0.0.1' },
    get: (name: string) => (name === 'origin' ? origin : 'test-agent'),
  } as unknown as Request;
  return {
    service,
    limiter,
    request,
    controller: new SetupController(service as never, limiter as never),
  };
}
describe('SetupController rate limit ordering', () => {
  it('rejects invalid origin before accessing the limiter or creating a user', async () => {
    const { controller, request, service, limiter } = fixture(
      'https://invalid.example',
    );
    await expect(
      controller.createInitialAdmin(payload, request),
    ).rejects.toMatchObject({ response: { code: 'SETUP_INVALID_ORIGIN' } });
    expect(limiter.consume).not.toHaveBeenCalled();
    expect(service.createInitialAdmin).not.toHaveBeenCalled();
  });
  it('counts attempts before validating the payload', async () => {
    const { controller, request, service, limiter } = fixture();
    await expect(
      controller.createInitialAdmin(undefined, request),
    ).rejects.toBeDefined();
    expect(limiter.consume).toHaveBeenCalledWith('192.0.2.1');
    expect(service.createInitialAdmin).not.toHaveBeenCalled();
  });
  it('does not create a user if PostgreSQL fails', async () => {
    const { controller, request, service, limiter } = fixture();
    const failure = new Error('Limiter unavailable');
    limiter.consume.mockRejectedValue(failure);
    await expect(controller.createInitialAdmin(payload, request)).rejects.toBe(
      failure,
    );
    expect(service.createInitialAdmin).not.toHaveBeenCalled();
  });
  it('awaits the limiter before creating the administrator', async () => {
    const { controller, request, service, limiter } = fixture();
    let release!: () => void;
    limiter.consume.mockReturnValue(
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    );
    const result = controller.createInitialAdmin(
      { ...payload, passwordConfirmation: payload.password },
      request,
    );
    expect(service.createInitialAdmin).not.toHaveBeenCalled();
    release();
    await expect(result).resolves.toEqual({ ok: true });
    expect(service.createInitialAdmin).toHaveBeenCalledWith(payload, {
      ipAddress: '192.0.2.1',
      origin: 'http://localhost:5173',
      userAgent: 'test-agent',
    });
  });
});
