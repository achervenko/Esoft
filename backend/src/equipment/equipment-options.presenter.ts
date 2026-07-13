import { getEquipmentStatusOptions } from './equipment-presenter';

type EquipmentCreateOptionsInput = {
  countries: Array<{ id: number; name: string }>;
  employees: Array<{
    firstName: string;
    id: number;
    lastName: string;
    middleName: string | null;
    position: string;
  }>;
  manufacturers: Array<{ id: number; name: string }>;
  nextVisibleId: number;
  sections: Array<{
    id: number;
    name: string;
    workshop: {
      name: string;
    };
  }>;
};

export function toEquipmentCreateOptions({
  countries,
  employees,
  manufacturers,
  nextVisibleId,
  sections,
}: EquipmentCreateOptionsInput) {
  return {
    nextVisibleId,
    manufacturers: manufacturers.map(({ id, name }) => ({ id, name })),
    countries: countries.map(({ id, name }) => ({ id, name })),
    sections: sections.map((section) => ({
      id: section.id,
      name: `${section.workshop.name} / ${section.name}`,
    })),
    employees: employees.map((employee) => ({
      id: employee.id,
      name: [employee.lastName, employee.firstName, employee.middleName]
        .filter(Boolean)
        .join(' '),
      position: employee.position,
    })),
    statuses: getEquipmentStatusOptions(),
  };
}
