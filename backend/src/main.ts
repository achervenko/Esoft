import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadRootEnvironment } from './config/root-environment';
import { configureApp } from './configure-app';
import { acquireBackendInstallationLock } from './infrastructure/installation-lock';

const { config, projectRoot } = loadRootEnvironment();

async function bootstrap() {
  const lease = acquireBackendInstallationLock(projectRoot);
  // Exit follows Nest's HTTP drain and application shutdown hooks. SIGKILL leaves
  // the lock in place deliberately, requiring an operator to verify termination.
  process.once('exit', () => {
    try {
      lease.release();
    } catch {
      console.error(`Unable to release installation lock: ${lease.lockPath}`);
      process.exitCode = 1;
    }
  });
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });

  app.enableShutdownHooks();

  configureApp(app, config);

  await app.listen(config.backend.port, config.backend.host);
}
void bootstrap();
