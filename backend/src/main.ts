import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadRootEnvironment } from './config/root-environment';
import { configureApp } from './configure-app';
import { acquireBackendInstallationLock } from './infrastructure/installation-lock';

// Preserve the call site for diagnosing overlapping PostgreSQL client queries.
process.on('warning', (warning) => {
  if (
    warning.name === 'DeprecationWarning' &&
    warning.message.startsWith(
      'Calling client.query() when the client is already executing a query',
    )
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
  // Keep an exit fallback for startup failures. Normal shutdown releases the
  // lease through Nest because Windows signal termination can skip 'exit'.
  process.once('exit', () => {
    try {
      lease.release();
    } catch {
      console.error(`Unable to release installation lock: ${lease.lockPath}`);
      process.exitCode = 1;
    }
  });
  const app = await NestFactory.create(
    {
      module: AppModule,
      providers: [
        {
          provide: 'INSTALLATION_LEASE_SHUTDOWN',
          useValue: { onApplicationShutdown: () => lease.release() },
        },
      ],
    },
    { bodyParser: false },
  );

  app.enableShutdownHooks();

  configureApp(app, config);

  await app.listen(config.backend.port, config.backend.host);
}
void bootstrap();
