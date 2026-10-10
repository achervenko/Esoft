import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadRootEnvironment } from './config/root-environment';
import { configureApp } from './configure-app';
import { acquireBackendInstallationLock } from './infrastructure/installation-lock';

// Preserve the call site for diagnosing overlapping PostgreSQL client queries.
process.on('warning', (warning) => {
  if (
    warning.name === 'DeprecationWarning' &&
    warning.message.startsWith('Calling client.query() when the client is already executing a query')
  ) {
    console.error('[PostgreSQL concurrent query trace]', warning.stack);
  }
});

const { config, projectRoot } = loadRootEnvironment();

async function bootstrap() {
  const lease = await acquireBackendInstallationLock(
    projectRoot,
    config.backend.port,
    config.backend.host,
  );
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
