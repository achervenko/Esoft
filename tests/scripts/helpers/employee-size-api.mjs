import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export async function verifyEmployeeSizeApi(prisma) {
  const { PpeEmployeesService } = require('../../../backend/dist/src/ppe/ppe-employees.service.js');
  const { PpeAuditService } = require('../../../backend/dist/src/ppe/ppe-audit.service.js');
  const { AuditLogService } = require('../../../backend/dist/src/audit/audit-log.service.js');
  const service = new PpeEmployeesService(prisma, new PpeAuditService(new AuditLogService(prisma)));
  const position = await prisma.position.findFirstOrThrow();
  const actor = await prisma.user.create({ data: { id: 'sizes-api-actor', name: 'Sizes actor', email: 'sizes-api@test.invalid' } });
  const employee = await prisma.employee.create({ data: { firstName: 'Sizes', lastName: 'API', positionId: position.id } });
  const empty = await service.findOne(employee.id);
  for (const name of ['clothingSize', 'clothingHeight', 'tshirtSize', 'tshirtHeight', 'shoeSize', 'gloveSize', 'headwearSize']) assert.equal(Object.hasOwn(empty, name), false);
  assert.equal(empty.ppeSizes, null);
  
  assert.equal(await prisma.ppeEmployeeSizes.findUnique({ where: { employeeId: employee.id } }), null);
  const first = await service.updateSizes(employee.id, { shoeSize: 42.5 }, actor.id);
  assert.equal(first.ppeSizes.shoeSize, 42.5);
  assert.equal(first.ppeSizes.clothingSize, null);
  assert.equal(Object.hasOwn(first, 'employeeId'), false);
  assert.equal(Object.hasOwn(first.ppeSizes, 'employeeId'), false);
  const second = await service.updateSizes(employee.id, { clothingSize: ' 52 ', tshirtSize: ' 48 ', tshirtHeight: '170-176' }, actor.id);
  assert.equal(second.ppeSizes.clothingSize, '52');
  assert.equal(second.ppeSizes.shoeSize, 42.5);
  assert.equal(second.ppeSizes.tshirtSize, '48');
  assert.equal(second.ppeSizes.tshirtHeight, '170–176');
  const tshirt = await prisma.ppeItem.create({ data: { article: 'TSHIRT-PROBE', name: 'Футболка', unit: 'шт', type: 'TSHIRT', sizes: { create: { value: '48', heightValue: '170–176' } } }, include: { sizes: true } });
  assert.equal(tshirt.sizes[0].heightValue, second.ppeSizes.tshirtHeight);
  assert.deepEqual((await service.list()).find((row) => row.id === employee.id), second);
  await assert.rejects(prisma.ppeEmployeeSizes.create({ data: { employeeId: employee.id } }), { code: 'P2002' });
  await assert.rejects(prisma.ppeEmployeeSizes.create({ data: { employeeId: -999 } }), { code: 'P2003' });
  const beforeAudit = await prisma.auditLog.count({ where: { entityType: 'employee', entityId: employee.id } });
  await service.updateSizes(employee.id, { shoeSize: 42.5 }, actor.id);
  assert.equal(await prisma.auditLog.count({ where: { entityType: 'employee', entityId: employee.id } }), beforeAudit);
  const other = await prisma.employee.create({ data: { firstName: 'Rollback', lastName: 'API', positionId: position.id } });
  const failing = new PpeEmployeesService(prisma, { async writeChanges() { throw new Error('Injected audit failure'); } });
  await assert.rejects(failing.updateSizes(other.id, { clothingSize: '54' }, actor.id), /Injected audit failure/);
  assert.equal(await prisma.ppeEmployeeSizes.findUnique({ where: { employeeId: other.id } }), null);
  await prisma.employee.delete({ where: { id: other.id } });
  assert.notEqual(await prisma.ppeEmployeeSizes.findUnique({ where: { employeeId: employee.id } }), null);
  await prisma.employee.delete({ where: { id: employee.id } });
  assert.equal(await prisma.ppeEmployeeSizes.findUnique({ where: { employeeId: employee.id } }), null);
}
