import { NestFactory } from '@nestjs/core';
import { json } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';

const isProduction = process.env.NODE_ENV === 'production';
const frontendUrl = process.env.FRONTEND_URL?.trim();

const isDefined = <T>(value: T | undefined): value is T => value !== undefined;

const corsOrigins = Array.from(
  new Set(
    [
      frontendUrl ?? 'http://127.0.0.1:5173',
      !isProduction ? 'http://127.0.0.1:5173' : undefined,
      !isProduction ? 'http://localhost:5173' : undefined,
    ].filter(isDefined),
  ),
);

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });
  const apiJsonParser = json({ limit: '2mb' });

  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/auth' || req.path.startsWith('/auth/')) {
      next();
      return;
    }

    apiJsonParser(req, res, next);
  });
  app.enableCors({
    credentials: true,
    exposedHeaders: ['Content-Disposition'],
    origin: corsOrigins,
  });
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
void bootstrap();
