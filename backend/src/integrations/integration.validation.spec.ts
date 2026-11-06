import { eventEnvelope, eventHash } from './integration.validation';
const body = {
  eventId: 'acbf4fd4-89c4-4f5d-b8f2-150665d3c680',
  objectId: '55',
  type: 'UPDATE',
  version: 'etag-10',
};
it('hashes a normalized envelope independently of JSON property order', () => {
  expect(eventHash(eventEnvelope(body))).toBe(
    eventHash(
      eventEnvelope({
        version: 'etag-10',
        type: 'UPDATE',
        objectId: '55',
        eventId: body.eventId.toUpperCase(),
      }),
    ),
  );
  expect(eventHash(eventEnvelope({ ...body, version: 'etag-11' }))).not.toBe(
    eventHash(eventEnvelope(body)),
  );
});
it.each([
  null,
  [],
  { ...body, extra: true },
  { ...body, eventId: 'bad' },
  { ...body, version: 10 },
  { ...body, objectId: '\0' },
  { ...body, type: 'x'.repeat(101) },
])('rejects invalid envelope %p', (value) => {
  expect(() => eventEnvelope(value)).toThrow();
});

it('accepts an ID-only notification and assigns a separate durable identity to each delivery', () => {
  const first = eventEnvelope({ objectId: 'receipt-1' });
  const second = eventEnvelope({ objectId: 'receipt-1' });
  expect(first).toEqual({
    eventId: first.eventId,
    objectId: 'receipt-1',
    type: 'OBJECT_CHANGED',
    version: '0',
  });
  expect(first.eventId).toMatch(/^[0-9a-f-]{36}$/);
  expect(first.eventId).not.toBe(second.eventId);
});
it.each([
  { objectId: '' },
  { objectId: '.' },
  { objectId: '..' },
  { objectId: 'x', extra: true },
])('rejects invalid object notification %p', (value) =>
  expect(() => eventEnvelope(value)).toThrow(),
);
