import assert from 'node:assert/strict';
import test from 'node:test';
import {
  integrationOptions,
  withDictionaryFixtures,
} from './dictionary-test-helpers.mjs';

test(
  'an inactive responsible employee remains available only for the existing equipment relation',
  integrationOptions,
  async () => {
    await withDictionaryFixtures(
      'XA',
      async ({ tx, query, validator, employee, equipment }) => {
        await tx.employee.update({
          where: { id: employee.id },
          data: { isActive: false },
        });
        assert.equal(
          (await query.getCreateOptions()).employees.some(
            (row) => row.id === employee.id,
          ),
          false,
        );
        assert.equal(
          (await query.getCreateOptions(equipment.visibleId)).employees.some(
            (row) => row.id === employee.id,
          ),
          true,
        );
        await assert.rejects(
          validator.assertResponsibleEmployeeIsActive(tx, employee.id),
        );
        await assert.rejects(
          validator.assertResponsibleEmployeeIsActive(
            tx,
            employee.id,
            employee.id + 1,
          ),
        );
        await validator.assertResponsibleEmployeeIsActive(
          tx,
          employee.id,
          employee.id,
        );
      },
    );
  },
);

test(
  'active model with inactive manufacturer rejects a new relation but preserves the current one',
  integrationOptions,
  async () => {
    await withDictionaryFixtures(
      'XB',
      async ({
        tx,
        service,
        query,
        validator,
        manufacturer,
        model,
        modelPayload,
        equipment,
      }) => {
        await service.deleteManufacturer(manufacturer.id);
        const record = await tx.equipmentModel.findUniqueOrThrow({
          where: { id: model.id },
          include: { manufacturer: true },
        });
        assert.equal(record.isActive, true);
        assert.equal(record.manufacturer.isActive, false);
        assert.equal(
          (await service.listEquipmentModels()).some(
            (row) => row.id === model.id,
          ),
          false,
        );
        assert.equal(
          (await query.getCreateOptions()).models.some(
            (row) => row.id === model.id,
          ),
          false,
        );
        const edit = await query.getCreateOptions(equipment.visibleId);
        assert.equal(
          edit.models.some((row) => row.id === model.id),
          true,
        );
        assert.equal(
          edit.manufacturers.some((row) => row.id === manufacturer.id),
          true,
        );
        await assert.rejects(service.createEquipmentModel(modelPayload));
        await assert.rejects(
          validator.assertEquipmentModelExists(tx, model.id),
          (error) => error.getStatus() === 400,
        );
        await assert.rejects(
          validator.assertEquipmentModelExists(tx, model.id, model.id + 1),
          (error) => error.getStatus() === 400,
        );
        await validator.assertEquipmentModelExists(tx, model.id, model.id);
      },
    );
  },
);

test(
  'active section with inactive workshop rejects a new relation but preserves the current one',
  integrationOptions,
  async () => {
    await withDictionaryFixtures(
      'XC',
      async ({
        tx,
        service,
        query,
        validator,
        object,
        location,
        locationPayload,
        equipment,
      }) => {
        await service.deleteObject(object.id);
        const record = await tx.section.findUniqueOrThrow({
          where: { id: location.id },
          include: { workshop: true },
        });
        assert.equal(record.isActive, true);
        assert.equal(record.workshop.isActive, false);
        assert.equal(
          (await service.listLocations()).some((row) => row.id === location.id),
          false,
        );
        assert.equal(
          (await query.getCreateOptions()).sections.some(
            (row) => row.id === location.id,
          ),
          false,
        );
        assert.equal(
          (await query.getCreateOptions(equipment.visibleId)).sections.some(
            (row) => row.id === location.id,
          ),
          true,
        );
        await assert.rejects(service.createLocation(locationPayload));
        await assert.rejects(
          validator.assertSectionExists(tx, location.id),
          (error) => error.getStatus() === 400,
        );
        await assert.rejects(
          validator.assertSectionExists(tx, location.id, location.id + 1),
          (error) => error.getStatus() === 400,
        );
        await validator.assertSectionExists(tx, location.id, location.id);
      },
    );
  },
);

test(
  'inactive model, country and section remain in edit options and equipment cards',
  integrationOptions,
  async () => {
    await withDictionaryFixtures(
      'XD',
      async ({
        tx,
        service,
        query,
        validator,
        model,
        country,
        location,
        equipment,
      }) => {
        await service.deleteEquipmentModel(model.id);
        await service.deleteLocation(location.id);
        await service.deleteCountry(country.id);
        const create = await query.getCreateOptions();
        const edit = await query.getCreateOptions(equipment.visibleId);
        for (const [key, id, validate] of [
          [
            'models',
            model.id,
            (current) =>
              validator.assertEquipmentModelExists(tx, model.id, current),
          ],
          [
            'sections',
            location.id,
            (current) =>
              validator.assertSectionExists(tx, location.id, current),
          ],
          [
            'countries',
            country.id,
            (current) => validator.assertCountryExists(tx, country.id, current),
          ],
        ]) {
          assert.equal(
            create[key].some((row) => row.id === id),
            false,
          );
          assert.equal(
            edit[key].some((row) => row.id === id),
            true,
          );
          await assert.rejects(validate(undefined));
          await validate(id);
        }
        const card = await query.findOneByVisibleId(equipment.visibleId);
        assert.equal(card.modelId, model.id);
        assert.equal(card.countryId, country.id);
        assert.equal(card.sectionId, location.id);
      },
    );
  },
);
