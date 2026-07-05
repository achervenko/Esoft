import { Table } from '@chakra-ui/react';

type EquipmentRegistryItem = {
  id: number;
  manufacturer: string;
  model: string;
  name: string;
  status: string;
};

const items: EquipmentRegistryItem[] = [
  {
    id: 1,
    manufacturer: 'Siemens',
    model: 'S7-1500',
    name: 'Контроллер линии сборки',
    status: 'В эксплуатации',
  },
  {
    id: 2,
    manufacturer: 'Omron',
    model: 'MX2',
    name: 'Частотный преобразователь',
    status: 'Резерв',
  },
  {
    id: 3,
    manufacturer: 'Bosch Rexroth',
    model: 'A10VSO',
    name: 'Гидравлический насос',
    status: 'В ремонте',
  },
  {
    id: 4,
    manufacturer: 'Festo',
    model: 'DSBC',
    name: 'Пневмоцилиндр',
    status: 'На обслуживании',
  },
];

export function EquipmentRegistryTable() {
  return (
    <div className="equipment-table-shell">
      <Table.Root size="sm" native>
        <thead>
          <tr>
            <th>Название оборудования</th>
            <th>Производитель</th>
            <th>Модель</th>
            <th>Статус</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td>{item.manufacturer}</td>
              <td>{item.model}</td>
              <td>{item.status}</td>
            </tr>
          ))}
        </tbody>
      </Table.Root>
    </div>
  );
}
