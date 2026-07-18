import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import {
  EquipmentCardView,
  type EquipmentViewTab,
} from "../../modules/equipment-card";
import {
  canEditEquipment,
  canManageEquipmentEvents,
  canManageMaintenanceSettings,
} from "../../modules/equipment-permissions";
import {
  getEquipmentCard,
  getEquipmentHistory,
} from "../../shared/api/equipment/equipment.api";
import type {
  EquipmentCard,
  EquipmentHistoryItem,
} from "../../shared/api/equipment/equipment.types";
import { getApiErrorMessage } from "../../shared/api/api-error";
import { Notice } from "../../shared/ui/Notice";
import "./EquipmentViewPage.css";

type EquipmentViewPageProps = {
  initialTab?: EquipmentViewTab;
  returnTo: string;
  userRole: string | null;
  visibleId: number;
};

export function EquipmentViewPage({
  initialTab = "details",
  returnTo,
  userRole,
  visibleId,
}: EquipmentViewPageProps) {
  const [activeTab, setActiveTab] = useState<EquipmentViewTab>(initialTab);
  const [equipment, setEquipment] = useState<EquipmentCard | null>(null);
  const [history, setHistory] = useState<EquipmentHistoryItem[]>([]);
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    setEquipment(null);
    setError(null);
    setIsLoading(true);

    getEquipmentCard(visibleId)
      .then((equipmentData) => {
        if (isMounted) {
          setEquipment(equipmentData);
        }
      })
      .catch((requestError) => {
        if (isMounted) {
          setError(getApiErrorMessage(requestError));
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

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setHistory([]);
    setHistoryError(null);
    setHasLoadedHistory(false);
    setIsHistoryLoading(false);
  }, [visibleId]);

  useEffect(() => {
    let isMounted = true;

    if (activeTab !== "history" || hasLoadedHistory) {
      return () => {
        isMounted = false;
      };
    }

    setHistory([]);
    setHistoryError(null);
    setIsHistoryLoading(true);

    getEquipmentHistory(visibleId)
      .then((historyData) => {
        if (isMounted) {
          setHistory(historyData);
          setHasLoadedHistory(true);
        }
      })
      .catch((requestError) => {
        if (isMounted) {
          setHistoryError(getApiErrorMessage(requestError));
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsHistoryLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activeTab, hasLoadedHistory, visibleId]);

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
          canManageEquipmentEvents={canManageEquipmentEvents(userRole)}
          canManageMaintenanceSettings={canManageMaintenanceSettings(userRole)}
          equipment={equipment}
          history={history}
          historyError={historyError}
          initialTab={initialTab}
          isHistoryLoading={isHistoryLoading}
          onTabChange={setActiveTab}
          returnTo={returnTo}
        />
      ) : null}
    </div>
  );
}
