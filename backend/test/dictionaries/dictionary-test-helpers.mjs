import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { after } from 'node:test';

const require = createRequire(import.meta.url);
let suitePrisma;
after(async () => {
  if (suitePrisma) await suitePrisma.$disconnect();
});
export const integrationOptions = {
  skip: process.env.ESOFT_DICTIONARY_INTEGRATION !== '1',
};

export async function withDictionaryFixtures(iso, action) {
  const {
    prismaService: prisma,
  } = require('../../dist/src/prisma/prisma.service.js');
  suitePrisma = prisma;
  const {
    DictionariesAdminService,
  } = require('../../dist/src/dictionaries-admin/dictionaries-admin.service.js');
  const {
    EquipmentQueryService,
  } = require('../../dist/src/equipment/equipment-query.service.js');
  const {
    EquipmentReferenceValidatorService,
  } = require('../../dist/src/equipment/equipment-reference-validator.service.js');

  assert.match(iso, /^[A-Z]{2}$/);
  const rollback = new Error('Rollback integration fixtures');
  const name = `Lifecycle ${randomUUID()}`;
  await assert.rejects(
    prisma.$transaction(
      async (tx) => {
        let savepoint = 0;
        const client = {
          manufacturer: tx.manufacturer,
          equipmentModel: tx.equipmentModel,
          country: tx.country,
          workshop: tx.workshop,
          section: tx.section,
          equipment: tx.equipment,
          employee: tx.employee,
          $transaction: async (operation) => {
            const marker = `dictionary_test_${++savepoint}`;
            await tx.$executeRawUnsafe(`SAVEPOINT ${marker}`);
            try {
              const result = await operation(tx);
              await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${marker}`);
              return result;
            } catch (error) {
              await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${marker}`);
              throw error;
            }
          },
        };
        const service = new DictionariesAdminService(
          new (require('../../dist/src/dictionaries-admin/manufacturers-admin.service.js').ManufacturersAdminService)(
            client,
          ),
          new (require('../../dist/src/dictionaries-admin/equipment-models-admin.service.js').EquipmentModelsAdminService)(
            client,
          ),
          new (require('../../dist/src/dictionaries-admin/countries-admin.service.js').CountriesAdminService)(
            client,
          ),
          new (require('../../dist/src/dictionaries-admin/objects-admin.service.js').ObjectsAdminService)(
            client,
          ),
          new (require('../../dist/src/dictionaries-admin/locations-admin.service.js').LocationsAdminService)(
            client,
          ),
        );
        const query = new EquipmentQueryService(
          { getNextId: async () => 1 },
          client,
        );
        const validator = new EquipmentReferenceValidatorService();
        const manufacturer = await service.createManufacturer({ name });
        const modelPayload = { name, manufacturerId: manufacturer.id };
        const model = await service.createEquipmentModel(modelPayload);
        const object = await service.createObject({ name });
        const locationPayload = { name, objectId: object.id };
        const location = await service.createLocation(locationPayload);
        const countryPayload = { name, iso };
        const country = await service.createCountry(countryPayload);
        const position = await tx.position.findFirstOrThrow();
        const employee = await tx.employee.create({
          data: {
            firstName: 'Тест',
            lastName: 'Тест',
            positionId: position.id,
          },
        });
        const equipment = await tx.equipment.create({
          data: {
            name,
            inventoryNumber: name,
            modelId: model.id,
            sectionId: location.id,
            countryId: country.id,
            responsibleEmployeeId: employee.id,
            issueDate: new Date('2026-10-09T00:00:00Z'),
          },
        });

        await action({
          tx,
          client,
          service,
          query,
          validator,
          name,
          manufacturer,
          model,
          object,
          location,
          country,
          employee,
          equipment,
          modelPayload,
          locationPayload,
          countryPayload,
        });
        throw rollback;
      },
      { timeout: 20_000 },
    ),
    (error) => error === rollback,
  );
  for (const table of [
    'manufacturer',
    'equipmentModel',
    'country',
    'workshop',
    'section',
    'equipment',
  ]) {
    assert.equal(await prisma[table].count({ where: { name } }), 0);
  }
}
