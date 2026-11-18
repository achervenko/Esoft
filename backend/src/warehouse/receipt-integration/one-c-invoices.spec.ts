import { randomUUID } from 'node:crypto';
import { IntegrationFailure } from '../../integrations/integration-errors';
import { readOneCInvoices } from './one-c-invoices';

const period = {
  dateFrom: '2026-11-14T07:00:00',
  dateTo: '2026-11-15T23:59:59',
};
const orderId = '060e8b25-df36-11f1-9608-40a8f031fdf3';
const invoice = () => ({
  id: randomUUID(),
  number: '0000-005974',
  date: '2026-11-13T16:15:15',
  status: 'POSTED',
  lines: [
    {
      row_no: 1,
      warehouse_id: 'c9570676-ec8e-11f0-9d39-e0071bf68d7b',
      warehouse_name: 'СКЛАД ЗАПЧАСТИ СЕРВИС',
      item_id: '1d8f2a73-df34-11f1-9608-40a8f031fdf3',
      item_article: '10014942',
      item_name: 'Масло редукторное',
      item_unit: 'шт',
      item_type: 'Товар',
      quantity: 2.125,
      order_id: orderId,
      order_number: '0000-000815',
    },
  ],
});
const page = (start: number, total: number, data: unknown[]) => ({
  Start_number: start,
  Total_number: total,
  data,
});

it('normalizes line identities and empty orders while retaining the document date', async () => {
  const raw = invoice();
  const withoutOrder = {
    ...raw.lines[0],
    row_no: 2,
    order_id: '',
    order_number: '',
  };
  const getJson = jest
    .fn()
    .mockResolvedValue(
      page(1, 1, [{ ...raw, lines: [...raw.lines, withoutOrder] }]),
    );
  await expect(readOneCInvoices({ getJson }, period)).resolves.toMatchObject([
    {
      id: raw.id,
      date: raw.date,
      lines: [
        {
          rowNumber: 1,
          warehouse: { id: raw.lines[0].warehouse_id },
          item: { id: raw.lines[0].item_id, article: '10014942' },
          quantity: '2.125',
          order: { id: orderId, number: '0000-000815' },
        },
        { rowNumber: 2, order: null },
      ],
    },
  ]);
});

it('reads start=51 after 50 documents and returns the same snapshot on replay', async () => {
  const documents = Array.from({ length: 51 }, invoice);
  const getJson = jest.fn((path: string) => {
    const url = new URL(path, 'http://server1c/ERP/hs/docs/');
    expect(url.pathname).toBe('/ERP/hs/docs/invoices');
    expect(url.searchParams.get('dateFrom')).toBe(period.dateFrom);
    expect(url.searchParams.get('dateTo')).toBe(period.dateTo);
    const start = Number(url.searchParams.get('start'));
    return Promise.resolve(
      page(start, documents.length, documents.slice(start - 1, start + 49)),
    );
  });
  const first = await readOneCInvoices({ getJson }, period);
  expect(first.map(({ id }) => id)).toEqual(documents.map(({ id }) => id));
  expect(await readOneCInvoices({ getJson }, period)).toEqual(first);
  expect(getJson.mock.calls.map(([path]) => path.split('start=')[1])).toEqual([
    '1',
    '51',
    '1',
    '51',
  ]);
});

it.each(['CREATED', 'CANCELED'])(
  'keeps %s available for preview',
  async (status) => {
    const getJson = jest
      .fn()
      .mockResolvedValue(page(1, 1, [{ ...invoice(), status, lines: [] }]));
    await expect(readOneCInvoices({ getJson }, period)).resolves.toMatchObject([
      { status },
    ]);
  },
);

it('accepts an empty period', async () => {
  const getJson = jest.fn().mockResolvedValue(page(1, 0, []));
  await expect(readOneCInvoices({ getJson }, period)).resolves.toEqual([]);
});

it.each(['empty', 'duplicate', 'changed total'])(
  'rejects an incomplete period with %s second page',
  async (kind) => {
    const first = Array.from({ length: 50 }, invoice);
    const getJson = jest
      .fn()
      .mockResolvedValueOnce(page(1, 51, first))
      .mockResolvedValueOnce(
        page(
          51,
          kind === 'changed total' ? 52 : 51,
          kind === 'empty' ? [] : [kind === 'duplicate' ? first[0] : invoice()],
        ),
      );
    await expect(readOneCInvoices({ getJson }, period)).rejects.toMatchObject({
      code: 'ONE_C_INVOICES_INCOMPLETE',
    });
  },
);

it('propagates failure on a later page without returning the first page', async () => {
  const failure = new IntegrationFailure('INTEGRATION_CONTENT_TYPE', true);
  const getJson = jest
    .fn()
    .mockResolvedValueOnce(page(1, 51, Array.from({ length: 50 }, invoice)))
    .mockRejectedValueOnce(failure);
  await expect(readOneCInvoices({ getJson }, period)).rejects.toBe(failure);
});

it('rejects an invalid period before contacting 1C', async () => {
  const getJson = jest.fn();
  await expect(
    readOneCInvoices(
      { getJson },
      { ...period, dateFrom: '2026-02-30T00:00:00' },
    ),
  ).rejects.toMatchObject({ code: 'ONE_C_INVOICES_PERIOD_INVALID' });
  expect(getJson).not.toHaveBeenCalled();
});

it.each([1, 49, 50, 100, 102])('loads all %s documents', async (total) => {
  const documents = Array.from({ length: total }, invoice);
  const getJson = jest.fn((path: string) => {
    const start = Number(
      new URL(path, 'http://server1c/').searchParams.get('start'),
    );
    return Promise.resolve(
      page(start, total, documents.slice(start - 1, start + 49)),
    );
  });
  await expect(readOneCInvoices({ getJson }, period)).resolves.toHaveLength(
    total,
  );
  expect(getJson).toHaveBeenCalledTimes(Math.ceil(total / 50));
});

it('accepts the 100th full page at the document limit', async () => {
  let start = 1;
  const getJson = jest.fn(() => {
    const response = page(start, 5000, Array.from({ length: 50 }, invoice));
    start += 50;
    return Promise.resolve(response);
  });
  await expect(readOneCInvoices({ getJson }, period)).resolves.toHaveLength(
    5000,
  );
  expect(getJson).toHaveBeenCalledTimes(100);
});

it.each([
  ['negative', { quantity: -1 }],
  ['excess precision', { quantity: 0.0001 }],
  ['malformed decimal', { quantity: '1,25' }],
  ['out of range', { quantity: '100000000000' }],
  ['invalid order UUID', { order_id: 'invalid' }],
  ['invalid row number', { row_no: 1.5 }],
])('rejects %s in a line', async (_name, patch) => {
  const raw = invoice();
  const getJson = jest
    .fn()
    .mockResolvedValue(
      page(1, 1, [{ ...raw, lines: [{ ...raw.lines[0], ...patch }] }]),
    );
  await expect(readOneCInvoices({ getJson }, period)).rejects.toMatchObject({
    code: 'ONE_C_INVOICES_RESPONSE_INVALID',
    retryable: false,
  });
  expect(getJson).toHaveBeenCalledTimes(1);
});

it.each([
  { id: 'invalid' },
  { status: 'UNKNOWN' },
  { lines: [invoice().lines[0], invoice().lines[0]] },
])('rejects invalid document %j', async (patch) => {
  const getJson = jest
    .fn()
    .mockResolvedValue(page(1, 1, [{ ...invoice(), ...patch }]));
  await expect(readOneCInvoices({ getJson }, period)).rejects.toMatchObject({
    code: 'ONE_C_INVOICES_RESPONSE_INVALID',
  });
});

it('preserves zero quantities and empty posted documents pending contract clarification', async () => {
  const raw = invoice();
  const getJson = jest.fn().mockResolvedValue(
    page(1, 2, [
      { ...raw, lines: [{ ...raw.lines[0], quantity: 0 }] },
      { ...invoice(), lines: [] },
    ]),
  );
  await expect(readOneCInvoices({ getJson }, period)).resolves.toMatchObject([
    { lines: [{ quantity: '0' }] },
    { lines: [] },
  ]);
});

it.each([
  'INTEGRATION_HTTP_TIMEOUT',
  'INTEGRATION_HTTP_UNAVAILABLE',
  'INTEGRATION_HTTP_503',
])('retries %s for the same page', async (code) => {
  const getJson = jest
    .fn()
    .mockResolvedValueOnce(page(1, 51, Array.from({ length: 50 }, invoice)))
    .mockRejectedValueOnce(new IntegrationFailure(code, true))
    .mockResolvedValueOnce(page(51, 51, [invoice()]));
  await expect(readOneCInvoices({ getJson }, period)).resolves.toHaveLength(51);
  const calls = getJson.mock.calls as [string][];
  expect(calls[1][0]).toBe(calls[2][0]);
});

it.each([
  'INTEGRATION_HTTP_401',
  'INTEGRATION_HTTP_429',
  'INTEGRATION_INVALID_JSON',
])('does not retry %s', async (code) => {
  const error = new IntegrationFailure(code, code === 'INTEGRATION_HTTP_429');
  const getJson = jest.fn().mockRejectedValue(error);
  await expect(readOneCInvoices({ getJson }, period)).rejects.toBe(error);
  expect(getJson).toHaveBeenCalledTimes(1);
});

it('gives up after three failed attempts on a later page', async () => {
  const error = new IntegrationFailure('INTEGRATION_HTTP_502', true);
  const getJson = jest
    .fn()
    .mockResolvedValueOnce(page(1, 51, Array.from({ length: 50 }, invoice)))
    .mockRejectedValue(error);
  await expect(readOneCInvoices({ getJson }, period)).rejects.toBe(error);
  expect(getJson).toHaveBeenCalledTimes(4);
});

it('honors cancellation between pages without returning the first page', async () => {
  const external = new AbortController();
  const getJson = jest
    .fn()
    .mockResolvedValueOnce(page(1, 51, Array.from({ length: 50 }, invoice)))
    .mockImplementationOnce(() => {
      external.abort();
      return Promise.reject(
        new IntegrationFailure('INTEGRATION_HTTP_ABORTED', true),
      );
    });
  await expect(
    readOneCInvoices({ getJson }, period, external.signal),
  ).rejects.toMatchObject({
    code: 'INTEGRATION_HTTP_ABORTED',
    retryable: false,
  });
  expect(getJson).toHaveBeenCalledTimes(2);
});

it('retains the operation deadline when an external signal is provided', async () => {
  const deadline = new AbortController();
  const external = new AbortController();
  const clock = jest
    .spyOn(AbortSignal, 'timeout')
    .mockReturnValue(deadline.signal);
  try {
    const getJson = jest.fn((_path: string, signal?: AbortSignal) => {
      deadline.abort();
      expect(signal?.aborted).toBe(true);
      return Promise.reject(
        new IntegrationFailure('INTEGRATION_HTTP_ABORTED', true),
      );
    });
    await expect(
      readOneCInvoices({ getJson }, period, external.signal),
    ).rejects.toMatchObject({
      code: 'ONE_C_INVOICES_TIMEOUT',
    });
    expect(clock).toHaveBeenCalledWith(45_000);
    expect(getJson).toHaveBeenCalledTimes(1);
  } finally {
    clock.mockRestore();
  }
});
