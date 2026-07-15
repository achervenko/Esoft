import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { canCreateEquipment } from "../../modules/equipment-permissions";
import { getEquipmentRegistry } from "../../shared/api/equipment/equipment.api";
import type { EquipmentRegistryItem } from "../../shared/api/equipment/equipment.types";
import { buildHashRoute } from "../../shared/lib/hash-navigation";
import { EquipmentRegistryTable } from "./EquipmentRegistryTable";
import "./EquipmentPage.css";

type EquipmentPageProps = {
  userRole: string | null;
};

export function EquipmentPage({ userRole }: EquipmentPageProps) {
  const isCreateAllowed = canCreateEquipment(userRole);
  const [items, setItems] = useState<EquipmentRegistryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    getEquipmentRegistry()
      .then((data) => {
        if (isMounted) {
          setItems(data);
        }
      })
      .catch((requestError: Error) => {
        if (isMounted) {
          setError(requestError.message);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const openEquipmentCard = (visibleId: number) => {
    window.location.hash = buildHashRoute(`#/equipment/${visibleId}`, {
      returnTo: "#/equipment",
    });
  };

  return (
    <div className="equipment-page">
      <header className="equipment-page-header">
        <h1>Реестр оборудования</h1>

        {isCreateAllowed ? (
          <a className="equipment-add-button" href="#/equipment/create">
            <Plus aria-hidden="true" size={18} />
            <span>Добавить</span>
          </a>
        ) : null}
      </header>

      <section
        className="equipment-table-section"
        aria-label="Реестр оборудования"
      >
        {isLoading ? (
          <p className="equipment-state-message">Загрузка реестра...</p>
        ) : null}
        {error ? (
          <p className="equipment-state-message error">{error}</p>
        ) : null}
        {!isLoading && !error ? (
          <EquipmentRegistryTable
            items={items}
            onOpenEquipment={openEquipmentCard}
          />
        ) : null}
      </section>
    </div>
  );
}
