import { INestApplication, type ExecutionContext } from '@nestjs/common';
import type { Reflector as NestReflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/configure-app';
import { HealthService } from './../src/health/health.service';

type HealthState = {
  dependencies: {
    minio: 'error' | 'ok';
    postgres: 'error' | 'ok';
  };
  status: 'error' | 'ok';
};

type HealthServiceMock = {
  check: jest.MockedFunction<() => Promise<HealthState>>;
};

type ReflectorLike = Pick<NestReflector, 'getAllAndOverride'>;

type RequestWithSession = {
  session?: unknown;
};

jest.mock('@thallesp/nestjs-better-auth', () => {
  const { createParamDecorator, SetMetadata } =
    jest.requireActual<typeof import('@nestjs/common')>('@nestjs/common');

  return {
    AllowAnonymous: () => SetMetadata('TEST_PUBLIC_ROUTE', true),
    AuthModule: {
      forRoot: () => ({
        module: class MockBetterAuthModule {},
      }),
    },
    Session: createParamDecorator(
      (_data: unknown, context: ExecutionContext) => {
        const request = context.switchToHttp().getRequest<RequestWithSession>();
        return request.session;
      },
    ),
  };
});

jest.mock('./../src/auth/auth.module', () => ({
  AppAuthModule: createMockAuthModule(),
}));

jest.mock('./../src/auth/auth.config', () => ({
  auth: {},
}));

jest.mock('better-auth/crypto', () => ({
  hashPassword: jest.fn((password: string) =>
    Promise.resolve(`hashed:${password}`),
  ),
}));

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let healthService: HealthServiceMock;

  beforeEach(async () => {
    healthService = {
      check: jest.fn().mockResolvedValue({
        dependencies: {
          minio: 'ok',
          postgres: 'ok',
        },
        status: 'ok',
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(HealthService)
      .useValue(healthService)
      .compile();

    app = moduleFixture.createNestApplication({
      bodyParser: false,
    });
    configureApp(app);
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('/health (GET) should be public and return 200 when dependencies are healthy', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({
        dependencies: {
          minio: 'ok',
          postgres: 'ok',
        },
        status: 'ok',
      });
  });

  it('/health (GET) should be public and return 503 when a dependency is unhealthy', () => {
    healthService.check.mockResolvedValueOnce({
      dependencies: {
        minio: 'error',
        postgres: 'ok',
      },
      status: 'error',
    });

    return request(app.getHttpServer())
      .get('/health')
      .expect(503)
      .expect({
        dependencies: {
          minio: 'error',
          postgres: 'ok',
        },
        status: 'error',
      });
  });

  it('/api/equipment (GET) should remain protected without authentication', () => {
    return request(app.getHttpServer()).get('/api/equipment').expect(401);
  });

  afterEach(async () => {
    await app.close();
  });
});

function createMockAuthModule() {
  const { Module, UnauthorizedException } =
    jest.requireActual<typeof import('@nestjs/common')>('@nestjs/common');
  const { APP_GUARD, Reflector } =
    jest.requireActual<typeof import('@nestjs/core')>('@nestjs/core');

  class MockAuthGuard {
    constructor(private readonly reflector: ReflectorLike) {}

    canActivate(context: { getClass(): unknown; getHandler(): unknown }) {
      const isPublic = this.reflector.getAllAndOverride<boolean>(
        'TEST_PUBLIC_ROUTE',
        [context.getHandler(), context.getClass()],
      );

      if (isPublic) {
        return true;
      }

      throw new UnauthorizedException();
    }
  }

  class MockAppAuthModule {}

  Module({
    providers: [
      {
        provide: APP_GUARD,
        inject: [Reflector],
        useFactory: (reflector: ReflectorLike) => new MockAuthGuard(reflector),
      },
    ],
  })(MockAppAuthModule);

  return MockAppAuthModule;
}
