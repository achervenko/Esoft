import type {
  IntegrationConnection,
  IntegrationHttpClient,
} from './integration.contracts';
import { decryptSourceAuthorization } from './integration-credentials';
import { IntegrationFailure } from './integration-errors';
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

export function validateHttpBaseUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new IntegrationFailure('INTEGRATION_URL_INVALID', false);
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.hash ||
    url.search
  )
    throw new IntegrationFailure('INTEGRATION_URL_INVALID', false);
  return new URL(url.href.replace(/\/+$/, '') + '/');
}
export function createIntegrationHttpClient(
  connection: IntegrationConnection,
): IntegrationHttpClient {
  const base = validateHttpBaseUrl(connection.baseUrl);
  return {
    async getJson(path, signal) {
      const url = new URL(path, base);
      if (
        url.origin !== base.origin ||
        !url.pathname.startsWith(base.pathname) ||
        url.username ||
        url.password ||
        path.startsWith('/') ||
        url.hash
      )
        throw new IntegrationFailure('INTEGRATION_PATH_INVALID', false);
      const authorization = decryptSourceAuthorization(
        connection.authorizationEncrypted,
      );
      const timeout = AbortSignal.timeout(10000);
      const requestSignal = signal
        ? AbortSignal.any([signal, timeout])
        : timeout;
      const transportFailure = () =>
        new IntegrationFailure(
          requestSignal.aborted
            ? requestSignal.reason === timeout.reason && timeout.aborted
              ? 'INTEGRATION_HTTP_TIMEOUT'
              : 'INTEGRATION_HTTP_ABORTED'
            : 'INTEGRATION_HTTP_UNAVAILABLE',
          true,
        );
      let response: Response;
      try {
        response = await fetch(url, {
          headers: {
            Authorization: authorization,
            Accept: 'application/json',
          },
          redirect: 'error',
          signal: requestSignal,
        });
      } catch {
        throw transportFailure();
      }
      const reject = async (code: string, retryable = true): Promise<never> => {
        try {
          await response.body?.cancel();
        } catch {
          /* Preserve the original protocol failure. */
        }
        throw new IntegrationFailure(code, retryable);
      };
      if (!response.ok)
        return reject(
          'INTEGRATION_HTTP_' + response.status,
          response.status >= 500 || [408, 425, 429].includes(response.status),
        );
      const mediaType = response.headers
        .get('content-type')
        ?.split(';', 1)[0]
        .trim()
        .toLowerCase();
      if (mediaType !== 'application/json')
        return reject('INTEGRATION_CONTENT_TYPE');
      if (
        Number(response.headers.get('content-length') ?? 0) > MAX_RESPONSE_BYTES
      )
        return reject('INTEGRATION_BODY_TOO_LARGE', false);
      const reader = response.body?.getReader();
      if (!reader)
        throw new IntegrationFailure('INTEGRATION_EMPTY_RESPONSE', true);
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        for (;;) {
          const part = await reader.read();
          if (part.done) break;
          size += part.value.length;
          if (size > MAX_RESPONSE_BYTES)
            throw new IntegrationFailure('INTEGRATION_BODY_TOO_LARGE', false);
          chunks.push(part.value);
        }
      } catch (error) {
        if (error instanceof IntegrationFailure) throw error;
        throw transportFailure();
      } finally {
        try {
          await reader.cancel();
        } catch {
          /* Preserve stream errors. */
        }
      }
      let json: string;
      try {
        json = new TextDecoder('utf-8', { fatal: true }).decode(
          Buffer.concat(chunks),
        );
      } catch {
        throw new IntegrationFailure('INTEGRATION_INVALID_UTF8', false);
      }
      try {
        return JSON.parse(json) as unknown;
      } catch {
        throw new IntegrationFailure('INTEGRATION_INVALID_JSON', false);
      }
    },
  };
}
