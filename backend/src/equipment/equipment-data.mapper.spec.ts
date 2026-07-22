import { BadRequestException } from '@nestjs/common';
import { EquipmentStatus } from '@prisma/client';
import {
  buildEquipmentData,
  parseEquipmentVisibleId,
} from './equipment-data.mapper';

describe('equipment data mapper', () => {
  describe('buildEquipmentData', () => {
    it('accepts valid required fields and returns normalized data', () => {
      expect(
        buildEquipmentData({
          commissioningDate: '10.02.2020',
          countryId: 5,
          inventoryNumber: '  INV-001  ',
          issueDate: '11.02.2020',
          manufactureYear: 2019,
          modelId: 2,
          name: '  Токарный станок  ',
          notes: '  Примечание  ',
          operationText: '  Операция  ',
          responsibleEmployeeId: 7,
          sectionId: 3,
          serialNumber: '  SN-1  ',
          specifications: '  Характеристики  ',
          status: EquipmentStatus.ACTIVE,
        }),
      ).toEqual({
        commissioningDate: new Date(Date.UTC(2020, 1, 10)),
        countryId: 5,
        inventoryNumber: 'INV-001',
        issueDate: new Date(Date.UTC(2020, 1, 11)),
        manufactureYear: 2019,
        modelId: 2,
        name: 'Токарный станок',
        notes: 'Примечание',
        operationText: 'Операция',
        responsibleEmployeeId: 7,
        sectionId: 3,
        serialNumber: 'SN-1',
        specifications: 'Характеристики',
        status: EquipmentStatus.ACTIVE,
      });
    });

    it('converts optional blank text fields to null', () => {
      expect(
        buildEquipmentData({
          inventoryNumber: 'INV-001',
          issueDate: '11.02.2020',
          modelId: 2,
          name: 'Станок',
          notes: '   ',
          operationText: '',
          responsibleEmployeeId: 7,
          sectionId: 3,
          specifications: '  ',
          status: EquipmentStatus.ACTIVE,
        }),
      ).toEqual(
        expect.objectContaining({
          notes: null,
          operationText: null,
          specifications: null,
        }),
      );
    });

    it('converts empty serial number and б/н to null', () => {
      expect(
        buildEquipmentData({
          inventoryNumber: 'INV-001',
          issueDate: '11.02.2020',
          modelId: 2,
          name: 'Станок',
          responsibleEmployeeId: 7,
          sectionId: 3,
          serialNumber: 'б/н',
          status: EquipmentStatus.ACTIVE,
        }).serialNumber,
      ).toBeNull();

      expect(
        buildEquipmentData({
          inventoryNumber: 'INV-002',
          issueDate: '11.02.2020',
          modelId: 2,
          name: 'Станок',
          responsibleEmployeeId: 7,
          sectionId: 3,
          serialNumber: '   ',
          status: EquipmentStatus.ACTIVE,
        }).serialNumber,
      ).toBeNull();
    });

    it('requires required fields', () => {
      expectBadRequestMessage(() =>
        buildEquipmentData({
          inventoryNumber: 'INV-001',
          issueDate: '11.02.2020',
          modelId: 2,
          responsibleEmployeeId: 7,
          sectionId: 3,
          status: EquipmentStatus.ACTIVE,
        }),
      ).toBe('Название оборудования обязательно.');

      expectBadRequestMessage(() =>
        buildEquipmentData({
          issueDate: '11.02.2020',
          modelId: 2,
          name: 'Станок',
          responsibleEmployeeId: 7,
          sectionId: 3,
          status: EquipmentStatus.ACTIVE,
        }),
      ).toBe('Инвентарный номер обязателен.');

      expectBadRequestMessage(() =>
        buildEquipmentData({
          inventoryNumber: 'INV-001',
          modelId: 2,
          name: 'Станок',
          responsibleEmployeeId: 7,
          sectionId: 3,
          status: EquipmentStatus.ACTIVE,
        }),
      ).toBe('Дата выдачи обязательна.');

      expectBadRequestMessage(() =>
        buildEquipmentData({
          inventoryNumber: 'INV-001',
          issueDate: '11.02.2020',
          modelId: 2,
          name: 'Станок',
          sectionId: 3,
          status: EquipmentStatus.ACTIVE,
        }),
      ).toBe('Ответственный обязателен.');
    });

    it('rejects too long values', () => {
      expectBadRequestMessage(() =>
        buildEquipmentData({
          inventoryNumber: 'INV-001',
          issueDate: '11.02.2020',
          modelId: 2,
          name: 'а'.repeat(129),
          responsibleEmployeeId: 7,
          sectionId: 3,
          status: EquipmentStatus.ACTIVE,
        }),
      ).toBe('Максимальная длина: 128 символов.');

      expectBadRequestMessage(() =>
        buildEquipmentData({
          inventoryNumber: 'INV-001',
          issueDate: '11.02.2020',
          modelId: 2,
          name: 'Станок',
          responsibleEmployeeId: 7,
          sectionId: 3,
          specifications: 'а'.repeat(4001),
          status: EquipmentStatus.ACTIVE,
        }),
      ).toBe('Технические характеристики слишком длинные.');
    });

    it('rejects invalid numeric identifiers', () => {
      expectBadRequestMessage(() =>
        buildEquipmentData({
          inventoryNumber: 'INV-001',
          issueDate: '11.02.2020',
          modelId: 0,
          name: 'Станок',
          responsibleEmployeeId: 7,
          sectionId: 3,
          status: EquipmentStatus.ACTIVE,
        }),
      ).toBe('Модель обязательна.');

      expectBadRequestMessage(() =>
        buildEquipmentData({
          inventoryNumber: 'INV-001',
          issueDate: '11.02.2020',
          modelId: 2,
          name: 'Станок',
          responsibleEmployeeId: 7,
          sectionId: -1,
          status: EquipmentStatus.ACTIVE,
        }),
      ).toBe('Местонахождение обязательно.');

      expectBadRequestMessage(() =>
        buildEquipmentData({
          countryId: 0,
          inventoryNumber: 'INV-001',
          issueDate: '11.02.2020',
          modelId: 2,
          name: 'Станок',
          responsibleEmployeeId: 7,
          sectionId: 3,
          status: EquipmentStatus.ACTIVE,
        }),
      ).toBe('Некорректная страна производства.');
    });

    it('rejects invalid status values', () => {
      expectBadRequestMessage(() =>
        buildEquipmentData({
          inventoryNumber: 'INV-001',
          issueDate: '11.02.2020',
          modelId: 2,
          name: 'Станок',
          responsibleEmployeeId: 7,
          sectionId: 3,
          status: 'UNKNOWN' as EquipmentStatus,
        }),
      ).toBe('Выберите допустимый статус оборудования.');
    });

    it('rejects manufacture year outside range', () => {
      expectBadRequestMessage(() =>
        buildEquipmentData({
          inventoryNumber: 'INV-001',
          issueDate: '11.02.2020',
          manufactureYear: 1899,
          modelId: 2,
          name: 'Станок',
          responsibleEmployeeId: 7,
          sectionId: 3,
          status: EquipmentStatus.ACTIVE,
        }),
      ).toBe('Год выпуска должен быть от 1900 до 2100.');
    });

    it('rejects invalid dates and date order', () => {
      expectBadRequestMessage(() =>
        buildEquipmentData({
          inventoryNumber: 'INV-001',
          issueDate: '31.02.2020',
          modelId: 2,
          name: 'Станок',
          responsibleEmployeeId: 7,
          sectionId: 3,
          status: EquipmentStatus.ACTIVE,
        }),
      ).toBe('Указана некорректная дата.');

      expectBadRequestMessage(() =>
        buildEquipmentData({
          commissioningDate: '10.02.2018',
          inventoryNumber: 'INV-001',
          issueDate: '11.02.2020',
          manufactureYear: 2019,
          modelId: 2,
          name: 'Станок',
          responsibleEmployeeId: 7,
          sectionId: 3,
          status: EquipmentStatus.ACTIVE,
        }),
      ).toBe('Год ввода в эксплуатацию не может быть меньше года выпуска.');

      expectBadRequestMessage(() =>
        buildEquipmentData({
          commissioningDate: '10.02.2020',
          inventoryNumber: 'INV-001',
          issueDate: '09.02.2020',
          modelId: 2,
          name: 'Станок',
          responsibleEmployeeId: 7,
          sectionId: 3,
          status: EquipmentStatus.ACTIVE,
        }),
      ).toBe('Дата выдачи не может быть раньше даты ввода в эксплуатацию.');

      expectBadRequestMessage(() =>
        buildEquipmentData({
          inventoryNumber: 'INV-001',
          issueDate: '11.02.2018',
          manufactureYear: 2019,
          modelId: 2,
          name: 'Станок',
          responsibleEmployeeId: 7,
          sectionId: 3,
          status: EquipmentStatus.ACTIVE,
        }),
      ).toBe('Дата выдачи не может быть раньше года выпуска оборудования.');
    });
  });

  describe('parseEquipmentVisibleId', () => {
    it('accepts a positive integer', () => {
      expect(parseEquipmentVisibleId(42)).toBe(42);
    });

    it('returns null for nullish and empty values', () => {
      expect(parseEquipmentVisibleId(null)).toBeNull();
      expect(parseEquipmentVisibleId(undefined)).toBeNull();
      expect(parseEquipmentVisibleId('')).toBeNull();
    });

    it('rejects zero, negative, fractional and string values', () => {
      expectBadRequestMessage(() => parseEquipmentVisibleId(0)).toBe(
        'Некорректный ID оборудования.',
      );
      expectBadRequestMessage(() => parseEquipmentVisibleId(-1)).toBe(
        'Некорректный ID оборудования.',
      );
      expectBadRequestMessage(() => parseEquipmentVisibleId(1.5)).toBe(
        'Некорректный ID оборудования.',
      );
      expectBadRequestMessage(() => parseEquipmentVisibleId('10')).toBe(
        'Некорректный ID оборудования.',
      );
    });
  });
});

function expectBadRequestMessage(action: () => unknown) {
  try {
    action();
  } catch (error) {
    if (error instanceof BadRequestException) {
      return expect(error.message);
    }

    throw error;
  }

  throw new Error('Expected BadRequestException to be thrown.');
}
