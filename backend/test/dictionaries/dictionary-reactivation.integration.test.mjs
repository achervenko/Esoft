import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import {
  integrationOptions,
  withDictionaryFixtures,
} from './dictionary-test-helpers.mjs';

test(
  'recreation restores the original IDs of all five dictionaries without duplicates',
  integrationOptions,
  async () => {
    await withDictionaryFixtures(
      'XE',
      async ({
        tx,
        service,
        name,
        manufacturer,
        model,
        object,
        location,
        country,
        modelPayload,
        locationPayload,
        countryPayload,
      }) => {
        const cases = [
          [
            'manufacturer',
            manufacturer,
            () => service.deleteManufacturer(manufacturer.id),
            () => service.createManufacturer({ name }),
          ],
          [
            'equipmentModel',
            model,
            () => service.deleteEquipmentModel(model.id),
            () => service.createEquipmentModel(modelPayload),
          ],
          [
            'workshop',
            object,
            () => service.deleteObject(object.id),
            () => service.createObject({ name }),
          ],
          [
            'section',
            location,
            () => service.deleteLocation(location.id),
            () => service.createLocation(locationPayload),
          ],
          [
            'country',
            country,
            () => service.deleteCountry(country.id),
            () => service.createCountry(countryPayload),
          ],
        ];
        for (const [table, record, deactivate, recreate] of cases) {
          await deactivate();
          assert.equal(
            (await tx[table].findUniqueOrThrow({ where: { id: record.id } }))
              .isActive,
            false,
          );
          assert.equal((await recreate()).id, record.id);
          assert.equal((await recreate()).id, record.id);
          assert.equal(
            (await tx[table].findUniqueOrThrow({ where: { id: record.id } }))
              .isActive,
            true,
          );
          assert.equal(await tx[table].count({ where: { name } }), 1);
        }
      },
    );
  },
);

test(
  'country conflicts on name, ISO or two different records do not reactivate either record',
  integrationOptions,
  async () => {
    await withDictionaryFixtures(
      'XF',
      async ({ tx, service, name, country }) => {
        await service.deleteCountry(country.id);
        await assert.rejects(
          service.createCountry({ name: `${name} other`, iso: country.iso }),
          (error) => error.getStatus() === 409,
        );
        await assert.rejects(
          service.createCountry({ name, iso: 'XH' }),
          (error) => error.getStatus() === 409,
        );
        const other = await service.createCountry({
          name: `${name} other`,
          iso: 'XH',
        });
        await service.deleteCountry(other.id);
        await assert.rejects(
          service.createCountry({ name, iso: 'XH' }),
          (error) => error.getStatus() === 409,
        );
        for (const id of [country.id, other.id]) {
          assert.equal(
            (await tx.country.findUniqueOrThrow({ where: { id } })).isActive,
            false,
          );
        }
      },
    );
  },
);

test(
  'recreating a deleted position preserves its ID and employee references',
  integrationOptions,
  async () => {
    await withDictionaryFixtures(
      'XI',
      async ({ tx, client, employee, name }) => {
        const require = createRequire(import.meta.url);
        const {
          PositionsAdminService,
        } = require('../../dist/src/users-admin/positions-admin.service.js');
        const positions = new PositionsAdminService(
          { ...client, position: tx.position },
          { writeFieldChanges: async () => {} },
        );
        const original = await positions.save(null, { name }, 'admin');
        await tx.employee.update({
          where: { id: employee.id },
          data: { positionId: original.id },
        });
        await positions.setStatus(original.id, false, 'admin');
        const restored = await positions.save(
          null,
          { name: name.toLowerCase() },
          'admin',
        );
        assert.equal(restored.id, original.id);
        assert.equal(restored.isActive, true);
        assert.equal(
          (await tx.employee.findUniqueOrThrow({ where: { id: employee.id } }))
            .positionId,
          original.id,
        );
        assert.equal(
          await tx.position.count({
            where: { name: { equals: name, mode: 'insensitive' } },
          }),
          1,
        );
        await assert.rejects(
          positions.save(null, { name }, 'admin'),
          (error) => error.getResponse().code === 'POSITION_ALREADY_EXISTS',
        );
      },
    );
  },
);

test(
  'model recreation ignores case and preserves equipment references',
  integrationOptions,
  async () => {
    await withDictionaryFixtures(
      'XJ',
      async ({ tx, service, model, modelPayload, equipment }) => {
        await service.deleteEquipmentModel(model.id);
        const restored = await service.createEquipmentModel({
          ...modelPayload,
          name: modelPayload.name.toUpperCase(),
        });
        assert.equal(restored.id, model.id);
        assert.equal(restored.isActive, true);
        assert.equal(
          (
            await tx.equipment.findUniqueOrThrow({
              where: { id: equipment.id },
            })
          ).modelId,
          model.id,
        );
        assert.equal(
          (
            await service.createEquipmentModel({
              ...modelPayload,
              name: modelPayload.name.toLowerCase(),
            })
          ).id,
          model.id,
        );
        assert.equal(
          await tx.equipmentModel.count({
            where: { manufacturerId: model.manufacturerId },
          }),
          1,
        );
      },
    );
  },
);
