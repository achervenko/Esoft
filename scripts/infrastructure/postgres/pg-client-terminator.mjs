export function terminatePgClient(client) {
  const stream = client?.connection?.stream;

  if (typeof stream?.destroy !== 'function') {
    throw new TypeError('PgClient transport cannot be forcibly terminated');
  }

  stream.destroy();
}
