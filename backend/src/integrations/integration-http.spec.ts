import { createIntegrationHttpClient } from './integration-http';
import {
  encryptSourceAuthorization,
  decryptSourceAuthorization,
} from './integration-credentials';
import { IntegrationRegistry } from './integration-registry';
import { OneCIntegrationAdapter } from './adapters/one-c.adapter';
jest.mock('../config/root-environment', () => ({
  loadRootConfig: () => ({ auth: { secret: 'integration-test-secret-only' } }),
}));
afterEach(() => jest.restoreAllMocks());
const connection = () => ({
  baseUrl: 'http://example.test/service/',
  authorizationEncrypted: encryptSourceAuthorization('Bearer test-secret'),
});
it('keeps existing ciphertext readable, authenticates HTTP and returns raw JSON without domain parsing', async () => {
  const config = connection();
  expect(decryptSourceAuthorization(config.authorizationEncrypted)).toBe(
    'Bearer test-secret',
  );
  const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response('{"differentModule":true}', {
      headers: { 'content-type': 'Application/JSON; Charset=UTF-8' },
    }),
  );
  expect(
    await createIntegrationHttpClient(config).getJson('objects/1'),
  ).toEqual({ differentModule: true });
  expect(fetch.mock.calls[0][0]).toEqual(
    new URL('http://example.test/service/objects/1'),
  );
  expect(fetch.mock.calls[0][1]).toMatchObject({
    redirect: 'error',
    headers: { Authorization: 'Bearer test-secret' },
  });
});
it.each([
  'https://other.test/objects',
  '/other',
  '../other',
  '%2e%2e/other',
  '//other.test/objects',
])('rejects a path outside the configured source: %s', async (path) => {
  const fetch = jest.spyOn(globalThis, 'fetch');
  await expect(
    createIntegrationHttpClient(connection()).getJson(path),
  ).rejects.toThrow('INTEGRATION_PATH_INVALID');
  expect(fetch).not.toHaveBeenCalled();
});
it.each([
  ['http://user:pass@example.test/'],
  ['file:///tmp/test'],
  ['http://example.test/?secret=1'],
  ['http://example.test/#fragment'],
])('adapter rejects unsafe source configuration %s', (baseUrl) => {
  const adapter = new OneCIntegrationAdapter(new IntegrationRegistry());
  expect(() => adapter.validateSourceConfig({ baseUrl })).toThrow(
    'INTEGRATION_URL_INVALID',
  );
});
it.each([
  [401, false],
  [403, false],
  [408, true],
  [429, true],
  [503, true],
])(
  'classifies HTTP %s without persisting a secret response',
  async (status, retryable) => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('sensitive-body', { status }));
    await expect(
      createIntegrationHttpClient(connection()).getJson('objects/1'),
    ).rejects.toMatchObject({
      code: `INTEGRATION_HTTP_${status}`,
      retryable,
      message: `INTEGRATION_HTTP_${status}`,
    });
  },
);

it('normalizes fetch network failures', async () => {
  jest
    .spyOn(globalThis, 'fetch')
    .mockRejectedValue(new TypeError('fetch failed'));
  await expect(
    createIntegrationHttpClient(connection()).getJson('objects/1'),
  ).rejects.toMatchObject({
    name: 'IntegrationFailure',
    code: 'INTEGRATION_HTTP_UNAVAILABLE',
    retryable: true,
  });
});
it.each(['timeout', 'abort'] as const)(
  'normalizes %s during fetch and body reads',
  async (kind) => {
    for (const phase of ['fetch', 'body']) {
      const controller = new AbortController();
      if (kind === 'timeout') {
        jest.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
      }
      const fail = () => {
        controller.abort(
          new DOMException(
            'cancelled',
            kind === 'timeout' ? 'TimeoutError' : 'AbortError',
          ),
        );
        return controller.signal.reason as DOMException;
      };
      jest.spyOn(globalThis, 'fetch').mockImplementation(() => {
        if (phase === 'fetch') return Promise.reject(fail());
        return Promise.resolve(
          new Response(
            new ReadableStream({
              pull(stream) {
                stream.error(fail());
              },
            }),
            { headers: { 'content-type': 'application/json' } },
          ),
        );
      });
      await expect(
        createIntegrationHttpClient(connection()).getJson(
          'objects/1',
          kind === 'abort' ? controller.signal : undefined,
        ),
      ).rejects.toMatchObject({
        name: 'IntegrationFailure',
        code:
          kind === 'timeout'
            ? 'INTEGRATION_HTTP_TIMEOUT'
            : 'INTEGRATION_HTTP_ABORTED',
        retryable: true,
      });
      jest.restoreAllMocks();
    }
  },
);
it('normalizes a disconnected response stream', async () => {
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(
      new ReadableStream({
        start(stream) {
          stream.error(new TypeError('connection terminated'));
        },
      }),
      { headers: { 'content-type': 'application/json' } },
    ),
  );
  await expect(
    createIntegrationHttpClient(connection()).getJson('objects/1'),
  ).rejects.toMatchObject({
    code: 'INTEGRATION_HTTP_UNAVAILABLE',
    retryable: true,
  });
});
it('preserves a non-retryable streaming size failure', async () => {
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(new Uint8Array(2 * 1024 * 1024 + 1), {
      headers: { 'content-type': 'application/json' },
    }),
  );
  await expect(
    createIntegrationHttpClient(connection()).getJson('objects/1'),
  ).rejects.toMatchObject({
    code: 'INTEGRATION_BODY_TOO_LARGE',
    retryable: false,
  });
});
