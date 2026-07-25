import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadRootConfig } from './config/root-environment';
import { configureApp } from './configure-app';

const config = loadRootConfig();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });

  configureApp(app, config);

  await app.listen(config.backend.port, config.backend.host);
}
void bootstrap();
