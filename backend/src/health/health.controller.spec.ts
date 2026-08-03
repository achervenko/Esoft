import { PATH_METADATA } from '@nestjs/common/constants';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

jest.mock('@thallesp/nestjs-better-auth', () => ({
  AllowAnonymous: () => () => undefined,
}));

describe('HealthController', () => {
  it('uses the public /api/health route', () => {
    expect(Reflect.getMetadata(PATH_METADATA, HealthController)).toBe(
      'api/health',
    );
  });

  it('keeps HTTP 200 when readiness is ok', async () => {
    const controller = createController({
      dependencies: {
        minio: 'ok',
        minioBucket: 'ok',
        postgres: 'ok',
      },
      status: 'ok',
    });
    const response = createResponse();

    await expect(controller.getHealth(response)).resolves.toEqual({
      dependencies: {
        minio: 'ok',
        minioBucket: 'ok',
        postgres: 'ok',
      },
      status: 'ok',
    });
    expect(response.status).not.toHaveBeenCalled();
  });

  it('sets HTTP 503 when readiness has an error', async () => {
    const controller = createController({
      dependencies: {
        minio: 'ok',
        minioBucket: 'error',
        postgres: 'ok',
      },
      status: 'error',
    });
    const response = createResponse();

    await controller.getHealth(response);

    expect(response.status).toHaveBeenCalledWith(503);
  });
});

type HealthResponse = Awaited<ReturnType<HealthService['check']>>;

function createController(health: HealthResponse) {
  return new HealthController({
    check: jest.fn().mockResolvedValue(health),
  } as unknown as HealthService);
}

function createResponse() {
  return {
    status: jest.fn(),
  } as never;
}
