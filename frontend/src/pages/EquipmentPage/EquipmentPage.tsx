import { Plus } from 'lucide-react';
import { EquipmentRegistryTable } from './EquipmentRegistryTable';
import './EquipmentPage.css';

type EquipmentPageProps = {
  userRole: string | null;
};

const rolesAllowedToCreateEquipment = new Set(['admin', 'engineer', 'chief_engineer']);

export function EquipmentPage({ userRole }: EquipmentPageProps) {
  const canCreateEquipment = Boolean(userRole && rolesAllowedToCreateEquipment.has(userRole));

  return (
    <div className="equipment-page">
      <header className="equipment-page-header">
        <h1>Реестр оборудования</h1>

        {canCreateEquipment ? (
          <a className="equipment-add-button" href="#/equipment/create">
            <Plus aria-hidden="true" size={18} />
            <span>Добавить оборудование</span>
          </a>
        ) : null}
      </header>

      <section className="equipment-table-section" aria-label="Реестр оборудования">
        <EquipmentRegistryTable />
      </section>
    </div>
  );
}
