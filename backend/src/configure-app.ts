import { type INestApplication } from '@nestjs/common';
import { json } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { getFrontendOrigins } from './config/frontend-origins';
import { type EsoftConfig, loadRootConfig } from './config/root-environment';

export function configureApp(
  app: INestApplication,
  config: EsoftConfig = loadRootConfig(),
) {
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
    origin: getFrontendOrigins(config),
  });
}
