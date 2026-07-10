import { EquipmentStatusBadge } from '../equipment-status';
import type { EquipmentCard } from '../../shared/api/equipment-api';
import {
  formatNullableNumber,
  formatNullableText,
  formatRuDate,
} from '../../shared/lib/formatters';
import './EquipmentCardView.css';

type EquipmentCardViewProps = {
  equipment: EquipmentCard;
};

type EquipmentCardField = {
  label: string;
  value: string;
};

type EquipmentCardSection = {
  fields: EquipmentCardField[];
  title: string;
};

type EquipmentCardTextBlock = {
  label: string;
  value: string | null;
};

export function EquipmentCardView({ equipment }: EquipmentCardViewProps) {
  const sections = getEquipmentCardSections(equipment);
  const textBlocks = getEquipmentCardTextBlocks(equipment);

  return (
    <article className="equipment-card-view">
      <header className="equipment-card-view-header">
        <div>
          <h1>
            ID {equipment.visibleId} — {equipment.name}
          </h1>
        </div>
        <EquipmentStatusBadge
          className="equipment-card-view-status"
          label={equipment.statusLabel}
          status={equipment.status}
        />
      </header>

      {sections.map((section) => (
        <section className="equipment-card-view-section" key={section.title}>
          <h2>{section.title}</h2>
          <EquipmentCardGrid items={section.fields} />
        </section>
      ))}

      <section className="equipment-card-view-section">
        <h2>Описание</h2>
        {textBlocks.map((block) => (
          <EquipmentTextBlock
            key={block.label}
            label={block.label}
            value={block.value}
          />
        ))}
      </section>
    </article>
  );
}

function getEquipmentCardSections(
  equipment: EquipmentCard,
): EquipmentCardSection[] {
  return [
    {
      title: 'Основные данные',
      fields: [
        { label: 'Производитель', value: equipment.manufacturer },
        { label: 'Модель', value: equipment.model },
        { label: 'Заводской номер', value: equipment.serialNumber ?? 'б/н' },
        {
          label: 'Дата ввода в эксплуатацию',
          value: formatRuDate(equipment.commissioningDate),
        },
      ],
    },
    {
      title: 'Местонахождение',
      fields: [
        { label: 'Местонахождение', value: equipment.location },
        { label: 'Ответственный', value: equipment.responsible },
        { label: 'Дата выдачи', value: formatRuDate(equipment.issueDate) },
        { label: 'Должность', value: equipment.responsiblePosition },
      ],
    },
    {
      title: 'Учетные данные',
      fields: [
        { label: 'Инвентарный номер', value: equipment.inventoryNumber },
        { label: 'Страна производства', value: equipment.country },
        {
          label: 'Год выпуска',
          value: formatNullableNumber(equipment.manufactureYear),
        },
      ],
    },
  ];
}

function getEquipmentCardTextBlocks(
  equipment: EquipmentCard,
): EquipmentCardTextBlock[] {
  return [
    {
      label: 'Технические характеристики',
      value: equipment.specifications,
    },
    {
      label: 'Технологическая операция',
      value: equipment.operationText,
    },
    {
      label: 'Примечание',
      value: equipment.notes,
    },
  ];
}

function EquipmentCardGrid({ items }: { items: EquipmentCardField[] }) {
  return (
    <dl className="equipment-card-view-grid">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function EquipmentTextBlock({ label, value }: EquipmentCardTextBlock) {
  return (
    <div className="equipment-card-view-text">
      <h3>{label}</h3>
      <p>{formatNullableText(value)}</p>
    </div>
  );
}
