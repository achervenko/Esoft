import { useMemo, useState } from 'react';
import { EquipmentStatusBadge } from '../../modules/equipment-status';
import type { EquipmentRegistryItem } from '../../shared/api/equipment-api';
import {
  DataTable,
  type DataTableColumn,
  type DataTableSortDirection,
} from '../../shared/ui/DataTable';
import { sortDataTableRows } from '../../shared/ui/data-table-model';

type EquipmentRegistryTableProps = {
  items: EquipmentRegistryItem[];
  onOpenEquipment: (visibleId: number) => void;
};

type EquipmentSortKey =
  | 'inventoryNumber'
  | 'manufacturer'
  | 'model'
  | 'name'
  | 'serialNumber'
  | 'statusLabel'
  | 'visibleId';

const equipmentColumns: Array<
  DataTableColumn<EquipmentRegistryItem, EquipmentSortKey>
> = [
  {
    key: 'visibleId',
    label: 'ID',
    render: (item) => item.visibleId,
    sortValue: (item) => item.visibleId,
  },
  {
    key: 'name',
    label: 'Название оборудования',
    render: (item) => item.name,
    sortValue: (item) => item.name,
  },
  {
    key: 'manufacturer',
    label: 'Производитель',
    render: (item) => item.manufacturer,
    sortValue: (item) => item.manufacturer,
  },
  {
    key: 'model',
    label: 'Модель',
    render: (item) => item.model,
    sortValue: (item) => item.model,
  },
  {
    key: 'inventoryNumber',
    label: 'Инвентарный номер',
    render: (item) => item.inventoryNumber,
    sortValue: (item) => item.inventoryNumber,
  },
  {
    key: 'serialNumber',
    label: 'Заводской номер',
    render: (item) => item.serialNumber ?? 'б/н',
    sortValue: (item) => item.serialNumber ?? 'б/н',
  },
  {
    key: 'statusLabel',
    label: 'Статус',
    render: (item) => (
      <EquipmentStatusBadge label={item.statusLabel} status={item.status} />
    ),
    sortValue: (item) => item.statusLabel,
  },
];

const defaultEquipmentSort = {
  direction: 'asc' as DataTableSortDirection,
  key: 'visibleId' as EquipmentSortKey,
};

export function EquipmentRegistryTable({
  items,
  onOpenEquipment,
}: EquipmentRegistryTableProps) {
  const [mobileSort] = useState(defaultEquipmentSort);
  const sortedMobileItems = useMemo(
    () => sortDataTableRows(items, equipmentColumns, mobileSort),
    [items, mobileSort],
  );

  if (items.length === 0) {
    return (
      <div className="equipment-empty-state">
        <h2>Оборудование пока не добавлено</h2>
        <p>
          После создания первой карточки она появится в реестре.
        </p>
      </div>
    );
  }

  return (
    <div className="equipment-table-shell">
      <DataTable
        columns={equipmentColumns}
        defaultSort={defaultEquipmentSort}
        getRowKey={(item) => item.id}
        onRowDoubleClick={(item) => onOpenEquipment(item.visibleId)}
        rows={items}
      />

      <div className="equipment-registry-cards" aria-label="Реестр оборудования">
        {sortedMobileItems.map((item) => (
          <article
            className="equipment-registry-card"
            key={item.id}
            onDoubleClick={() => onOpenEquipment(item.visibleId)}
          >
            <span className="equipment-card-id">ID {item.visibleId}</span>
            <h2>{item.name}</h2>
            <dl>
              <div>
                <dt>Производитель</dt>
                <dd>{item.manufacturer}</dd>
              </div>
              <div>
                <dt>Модель</dt>
                <dd>{item.model}</dd>
              </div>
              <div>
                <dt>Инв. номер</dt>
                <dd>{item.inventoryNumber}</dd>
              </div>
              <div>
                <dt>Заводской</dt>
                <dd>{item.serialNumber ?? 'б/н'}</dd>
              </div>
              <div>
                <dt>Статус</dt>
                <dd>
                  <EquipmentStatusBadge
                    label={item.statusLabel}
                    status={item.status}
                  />
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </div>
  );
}
