import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const {
  SearchQueryService,
} = require('../../dist/src/search/search-query.service.js');

export function registerTests({ prisma }) {
  test('PPE search ranks norms before unique employees matched by primary and additional positions', async () => {
    const quality = await prisma.position.create({
      data: { name: 'Менеджер по качеству' },
    });
    const purchasing = await prisma.position.create({
      data: { name: 'Менеджер по закупкам' },
    });
    const unrelated = await prisma.position.create({
      data: { name: 'Геодезист' },
    });
    await prisma.ppeNorm.create({
      data: {
        positionId: quality.id,
        gender: 'MALE',
        effectiveFrom: new Date('2025-01-01'),
      },
    });
    const createEmployee = (lastName, primary, additional, isActive = true) =>
      prisma.employee.create({
        data: {
          firstName: 'Иван',
          lastName,
          isActive,
          positionId: primary.id,
          additionalPositions: { create: { positionId: additional.id } },
        },
      });
    const both = await createEmployee('Менов', quality, purchasing);
    const additionalOnly = await createEmployee(
      'Яковлев',
      unrelated,
      purchasing,
    );
    await createEmployee('Менов', quality, purchasing, false);

    const service = new SearchQueryService(prisma, ['ppe']);
    const query = { query: 'мен', module: 'ppe' };
    const results = await service.search(query, 'admin');
    assert.deepEqual(
      results.map(({ entityType, entityId }) => [entityType, entityId]),
      [
        ['ppe_norm', quality.id],
        ['employee', both.id],
        ['employee', additionalOnly.id],
      ],
    );
    assert.ok(results[1].subtitle.includes(quality.name));
    assert.ok(results[1].subtitle.includes(purchasing.name));
    assert.equal(results[2].subtitle, purchasing.name);
    assert.deepEqual(
      await service.search({ ...query, limit: 1, offset: 1 }, 'admin'),
      results.slice(1, 2),
    );
    const byName = await service.search(
      { ...query, query: 'Яковлев Иван' },
      'admin',
    );
    assert.equal(byName[0].entityId, additionalOnly.id);
    assert.equal(byName[0].subtitle, unrelated.name);
  });
}
