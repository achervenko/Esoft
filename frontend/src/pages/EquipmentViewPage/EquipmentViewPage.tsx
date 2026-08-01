import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import type { MouseEvent } from "react";
import {
  EquipmentCardView,
  type EquipmentViewTab,
} from "../../modules/equipment-card";
import { setHashRoute } from "../../lib/hash-router";
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
import { useNotifications } from "../../shared/ui/notifications";
import "./EquipmentViewPage.css";

type EquipmentViewPageProps = {
  eventId?: number | null;
  initialTab?: EquipmentViewTab;
  returnTo: string;
  userRole: string | null;
  visibleId: number;
};

export function EquipmentViewPage({
  eventId = null,
  initialTab = "details",
  returnTo,
  userRole,
  visibleId,
}: EquipmentViewPageProps) {
  const { notifyError } = useNotifications();
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
          const errorMessage = getApiErrorMessage(requestError);
          setError(errorMessage);
          notifyError("Не удалось загрузить карточку оборудования", errorMessage);
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
  }, [notifyError, visibleId]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab, visibleId]);

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
          const errorMessage = getApiErrorMessage(requestError);
          setHistoryError(errorMessage);
          notifyError("Не удалось загрузить историю изменений", errorMessage);
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
  }, [activeTab, hasLoadedHistory, notifyError, visibleId]);

  const handleBackClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (shouldUseNativeLinkNavigation(event)) {
      return;
    }

    event.preventDefault();
    setHashRoute(returnTo);
  };

  return (
    <div className="equipment-view-page">
      <a className="equipment-back-link" href={returnTo} onClick={handleBackClick}>
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
          eventId={eventId}
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

function shouldUseNativeLinkNavigation(event: MouseEvent<HTMLAnchorElement>) {
  return (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey
  );
}
