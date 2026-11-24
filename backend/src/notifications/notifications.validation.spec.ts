import {
  parseNotificationList,
  validateNotification,
} from './notifications.validation';

const message = {
  eventKey: 'test:1',
  type: 'test',
  title: 'Test',
  body: 'Body',
  occurredAt: new Date('2026-11-21T12:00:00Z'),
  recipientIds: ['b', 'a', 'b'],
};
it.each([undefined, '#/orders/123', '/orders/123?tab=items'])(
  'accepts internal routes and canonicalizes recipient sets: %s',
  (targetPath) => {
    expect(validateNotification({ ...message, targetPath })).toEqual([
      'a',
      'b',
    ]);
  },
);
it.each([
  'https://example.com',
  '//example.com',
  '#//example.com',
  'javascript:alert(1)',
  '/\\example.com',
  '/%2fexample.com',
  '/%5cexample.com',
  '/\n/orders',
])('rejects unsafe targets: %s', (targetPath) => {
  expect(() => validateNotification({ ...message, targetPath })).toThrow();
});
it('requires at least one nonblank recipient', () => {
  expect(() =>
    validateNotification({ ...message, recipientIds: [] }),
  ).toThrow();
  expect(() =>
    validateNotification({ ...message, recipientIds: [' '] }),
  ).toThrow();
});
it('validates feed pagination and its filter', () => {
  expect(parseNotificationList({})).toEqual({
    unread: false,
    limit: 25,
    cursor: undefined,
  });
  expect(
    parseNotificationList({ filter: 'unread', limit: '100' }),
  ).toMatchObject({ unread: true, limit: 100 });
  for (const invalid of [
    { limit: '101' },
    { limit: '1.0' },
    { cursor: 'wrong' },
    { filter: 'pending' },
  ])
    expect(() => parseNotificationList(invalid)).toThrow();
});
