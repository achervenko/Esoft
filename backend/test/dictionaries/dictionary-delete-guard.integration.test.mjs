import assert from 'node:assert/strict';
import test from 'node:test';
import {
  integrationOptions,
  withDictionaryFixtures,
} from './dictionary-test-helpers.mjs';

test(
  'database triggers forbid physical deletion of all five dictionaries',
  integrationOptions,
  async () => {
    await withDictionaryFixtures(
      'XG',
      async ({
        tx,
        client,
        manufacturer,
        model,
        country,
        object,
        location,
      }) => {
        for (const [table, id] of [
          ['manufacturer', manufacturer.id],
          ['equipmentModel', model.id],
          ['country', country.id],
          ['workshop', object.id],
          ['section', location.id],
        ]) {
          assert.equal(
            (await tx[table].findUniqueOrThrow({ where: { id } })).isActive,
            true,
          );
          await assert.rejects(
            client.$transaction((connection) =>
              connection[table].delete({ where: { id } }),
            ),
            (error) => JSON.stringify(error).includes('P0001'),
          );
          assert.equal(
            (await tx[table].findUniqueOrThrow({ where: { id } })).isActive,
            true,
          );
        }
      },
    );
  },
);
