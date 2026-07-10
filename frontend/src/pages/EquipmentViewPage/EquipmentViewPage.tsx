import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { EquipmentCardView } from '../../modules/equipment-card';
import {
  getEquipmentCard,
  type EquipmentCard,
} from '../../shared/api/equipment-api';
import { Notice } from '../../shared/ui/Notice';
import './EquipmentViewPage.css';

type EquipmentViewPageProps = {
  visibleId: number;
};

export function EquipmentViewPage({ visibleId }: EquipmentViewPageProps) {
  const [equipment, setEquipment] = useState<EquipmentCard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    getEquipmentCard(visibleId)
      .then((data) => {
        if (isMounted) {
          setEquipment(data);
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
  }, [visibleId]);

  return (
    <div className="equipment-view-page">
      <a className="equipment-back-link" href="#/equipment">
        <ArrowLeft aria-hidden="true" size={18} />
        <span>К реестру</span>
      </a>

      {isLoading ? <Notice>Загрузка карточки оборудования...</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      {equipment ? <EquipmentCardView equipment={equipment} /> : null}
    </div>
  );
}
