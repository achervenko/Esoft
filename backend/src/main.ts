import { NestFactory } from '@nestjs/core';
import { json } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });
  app.use('/api/equipment', json({ limit: '2mb' }));
  app.enableCors({
    credentials: true,
    exposedHeaders: ['Content-Disposition'],
    origin: [
      process.env.FRONTEND_URL ?? 'http://127.0.0.1:5173',
      'http://127.0.0.1:5173',
      'http://localhost:5173',
    ],
  });
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
void bootstrap();
