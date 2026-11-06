import { parseConsolidation } from './transfers-consolidation.validation';
const body = {
  requestKey: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  itemId: '1',
  fromWarehouseId: '2',
  toLocationId: '3',
  moves: [
    { fromLocationId: '4', quantity: '2' },
    { fromLocationId: '4', quantity: '1', projectId: '7' },
  ],
};
describe('Consolidation validation', () => {
  it('normalizes order and preserves free and reserved rows separately', () => {
    expect(parseConsolidation(body)).toEqual(
      parseConsolidation({ ...body, moves: [...body.moves].reverse() }),
    );
    expect(parseConsolidation(body).moves.map((m) => m.projectId)).toEqual([
      null,
      '7',
    ]);
  });
  it.each([
    null,
    { ...body, moves: [] },
    { ...body, moves: [body.moves[0], body.moves[0]] },
    { ...body, moves: [{ fromLocationId: '3', quantity: '1' }] },
    { ...body, moves: [{ fromLocationId: '4', quantity: '0' }] },
    { ...body, extra: true },
    { ...body, moves: [{ ...body.moves[0], extra: true }] },
  ])('rejects malformed input %j', (value) =>
    expect(() => parseConsolidation(value)).toThrow(),
  );
});
