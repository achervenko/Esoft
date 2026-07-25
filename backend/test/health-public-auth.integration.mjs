import 'reflect-metadata';

import { Controller, Get, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AllowAnonymous, AuthModule } from '@thallesp/nestjs-better-auth';
import { betterAuth } from 'better-auth';
import request from 'supertest';

class HealthController {
  getHealth() {
    return {
      dependencies: {
        minio: 'ok',
        postgres: 'ok',
      },
      status: 'ok',
    };
  }
}

class EquipmentController {
  listEquipment() {
    return [];
  }
}

function applyGetRoute(controller, methodName) {
  const descriptor = Object.getOwnPropertyDescriptor(
    controller.prototype,
    methodName,
  );

  Get()(controller.prototype, methodName, descriptor);
}

AllowAnonymous()(HealthController);
Controller('health')(HealthController);
applyGetRoute(HealthController, 'getHealth');

Controller('api/equipment')(EquipmentController);
applyGetRoute(EquipmentController, 'listEquipment');

class TestAppModule {}

Module({
  imports: [
    AuthModule.forRoot({
      auth: betterAuth({
        baseURL: 'http://127.0.0.1:3000',
        secret: 'test-secret-that-is-long-enough-for-better-auth',
      }),
      disableControllers: true,
    }),
  ],
  controllers: [HealthController, EquipmentController],
})(TestAppModule);

const moduleFixture = await Test.createTestingModule({
  imports: [TestAppModule],
}).compile();
const app = moduleFixture.createNestApplication({
  bodyParser: false,
});

try {
  await app.init();

  await request(app.getHttpServer()).get('/health').expect(200);
  await request(app.getHttpServer()).get('/api/equipment').expect(401);
} finally {
  await app.close();
}
