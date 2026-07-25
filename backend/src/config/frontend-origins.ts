import type { EsoftConfig } from './root-environment';

export function getFrontendOrigins(
  config: EsoftConfig,
  frontendOrigin = config.frontend.url,
): string[] {
  const frontendOriginUrl = new URL(frontendOrigin);
  const frontendPort = frontendOriginUrl.port
    ? `:${frontendOriginUrl.port}`
    : '';

  return Array.from(
    new Set([
      frontendOriginUrl.origin,
      ...(config.nodeEnv !== 'production'
        ? [
            `${frontendOriginUrl.protocol}//localhost${frontendPort}`,
            `${frontendOriginUrl.protocol}//127.0.0.1${frontendPort}`,
          ]
        : []),
    ]),
  );
}
