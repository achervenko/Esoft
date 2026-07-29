import { AuditAction, AuditModule } from '@prisma/client';
import {
  type EquipmentEventAuditSnapshot,
  writeEquipmentEventUpdatedAudit,
} from './equipment-events.audit';

describe('equipment events audit', () => {
  function createSnapshot(
    overrides: Partial<EquipmentEventAuditSnapshot> = {},
  ): EquipmentEventAuditSnapshot {
    return {
      equipmentName: 'Pump',
      equipmentVisibleId: 1001,
      eventTypeCode: 'MAINTENANCE',
      eventTypeId: 10,
      eventTypeName: 'Maintenance',
      executionType: 'INTERNAL',
      id: 1,
      maintenanceSettingId: 20,
      ...overrides,
    };
  }

  it('writes only equipment-specific update audit fields', async () => {
    const tx = {
      auditLog: {
        createMany: jest.fn(),
      },
    };

    await writeEquipmentEventUpdatedAudit(tx as never, {
      newEvent: createSnapshot({
        equipmentName: 'Pump 2',
        equipmentVisibleId: 1002,
        eventTypeCode: 'REPAIR',
        eventTypeId: 11,
        eventTypeName: 'Repair',
        executionType: 'EXTERNAL',
        maintenanceSettingId: 21,
      }),
      oldEvent: createSnapshot(),
      userId: 'user-1',
    });

    const createMany = tx.auditLog.createMany as jest.MockedFunction<
      (args: {
        data: Array<{
          action: AuditAction;
          entityId: number;
          entityType: string;
          fieldName: string;
          module: AuditModule;
          newValue: string;
          oldValue: string;
          userId: string | null;
        }>;
      }) => void
    >;
    const auditRows = createMany.mock.calls[0]?.[0].data ?? [];
    const fieldNames = auditRows.map((item) => item.fieldName);

    expect(auditRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: AuditAction.UPDATE,
          entityId: 1,
          entityType: 'equipment_event',
          module: AuditModule.EQUIPMENT,
          userId: 'user-1',
        }),
      ]),
    );
    expect(fieldNames).toEqual([
      'Оборудование',
      'Вид обслуживания',
      'Настройка обслуживания',
      'Способ выполнения',
    ]);
    expect(fieldNames).not.toEqual(
      expect.arrayContaining([
        'Название',
        'Плановая дата',
        'Фактическая дата',
        'Ответственные',
        'Комментарий',
      ]),
    );
  });
});
