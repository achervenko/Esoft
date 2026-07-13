import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { EquipmentCardView } from '../../modules/equipment-card';
import { canEditEquipment } from '../../modules/equipment-permissions';
import {
  getEquipmentCard,
  getEquipmentHistory,
  type EquipmentCard,
  type EquipmentHistoryItem,
} from '../../shared/api/equipment-api';
import { Notice } from '../../shared/ui/Notice';
import './EquipmentViewPage.css';

type EquipmentViewPageProps = {
  initialTab?: 'details' | 'documents' | 'history';
  returnTo: string;
  userRole: string | null;
  visibleId: number;
};

export function EquipmentViewPage({
  initialTab = 'details',
  returnTo,
  userRole,
  visibleId,
}: EquipmentViewPageProps) {
  const [equipment, setEquipment] = useState<EquipmentCard | null>(null);
  const [history, setHistory] = useState<EquipmentHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    Promise.all([getEquipmentCard(visibleId), getEquipmentHistory(visibleId)])
      .then(([equipmentData, historyData]) => {
        if (isMounted) {
          setEquipment(equipmentData);
          setHistory(historyData);
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
          setIsHistoryLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [visibleId]);

  return (
    <div className="equipment-view-page">
      <a className="equipment-back-link" href={returnTo}>
        <ArrowLeft aria-hidden="true" size={18} />
        <span>Назад</span>
      </a>

      {isLoading ? <Notice>Загрузка карточки оборудования...</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      {equipment ? (
        <EquipmentCardView
          canEdit={canEditEquipment(userRole)}
          equipment={equipment}
          history={history}
          initialTab={initialTab}
          isHistoryLoading={isHistoryLoading}
          returnTo={returnTo}
        />
      ) : null}
    </div>
  );
}
