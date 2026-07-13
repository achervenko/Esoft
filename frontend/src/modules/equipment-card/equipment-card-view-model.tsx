import type { ReactNode } from "react";
import type { EquipmentCard } from "../../shared/api/equipment-api";
import {
  formatNullableNumber,
  formatRuDate,
} from "../../shared/lib/formatters";
import { EquipmentStatusBadge } from "../equipment-status";

export type EquipmentCardField = {
  label: string;
  value: ReactNode;
};

export type EquipmentCardSection = {
  fields: EquipmentCardField[];
  title: string;
};

export type EquipmentCardTextBlock = {
  label: string;
  value: string | null;
};

export function getEquipmentCardSections(
  equipment: EquipmentCard,
): EquipmentCardSection[] {
  return [
    {
      title: "Основные данные",
      fields: [
        { label: "Производитель", value: equipment.manufacturer },
        { label: "Модель", value: equipment.model },
        { label: "Заводской номер", value: equipment.serialNumber ?? "б/н" },
        {
          label: "Статус",
          value: (
            <EquipmentStatusBadge
              label={equipment.statusLabel}
              status={equipment.status}
            />
          ),
        },
      ],
    },
    {
      title: "Местонахождение",
      fields: [
        { label: "Местонахождение", value: equipment.location },
        { label: "Ответственный", value: equipment.responsible },
        { label: "Дата выдачи", value: formatRuDate(equipment.issueDate) },
        { label: "Должность", value: equipment.responsiblePosition },
      ],
    },
    {
      title: "Учетные данные",
      fields: [
        { label: "Инвентарный номер", value: equipment.inventoryNumber },
        { label: "Страна производства", value: equipment.country },
        {
          label: "Год выпуска",
          value: formatNullableNumber(equipment.manufactureYear),
        },
        {
          label: "Дата ввода в эксплуатацию",
          value: formatRuDate(equipment.commissioningDate),
        },
      ],
    },
  ];
}

export function getEquipmentCardTextBlocks(
  equipment: EquipmentCard,
): EquipmentCardTextBlock[] {
  return [
    {
      label: "Технические характеристики",
      value: equipment.specifications,
    },
    {
      label: "Технологическая операция",
      value: equipment.operationText,
    },
    {
      label: "Примечание",
      value: equipment.notes,
    },
  ];
}
