import { useCallback, useEffect, useRef, useState } from "react";
import {
  getEquipmentEvent,
  getEquipmentEvents,
} from "../../shared/api/equipment-events/equipment-events.api";
import type { EquipmentEventItem } from "../../shared/api/equipment-events/equipment-events.types";
import { getApiErrorMessage } from "../../shared/api/api-error";

export function useEquipmentEventsList(visibleId: number) {
  const [events, setEvents] = useState<EquipmentEventItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const detailRequestIdRef = useRef(0);

  const reloadEvents = useCallback(async () => {
    const eventItems = await getEquipmentEvents(visibleId, { limit: 100 });
    setEvents(eventItems);
    return eventItems;
  }, [visibleId]);

  const loadEventDetail = useCallback(async (eventId: number) => {
    const requestId = detailRequestIdRef.current + 1;
    detailRequestIdRef.current = requestId;

    setIsDetailLoading(true);
    setError(null);

    try {
      const eventDetail = await getEquipmentEvent(eventId);

      if (detailRequestIdRef.current !== requestId) {
        return null;
      }

      return eventDetail;
    } catch (requestError) {
      if (detailRequestIdRef.current === requestId) {
        setError(getApiErrorMessage(requestError));
      }

      return null;
    } finally {
      if (detailRequestIdRef.current === requestId) {
        setIsDetailLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    setEvents([]);
    setIsLoading(true);
    setError(null);

    getEquipmentEvents(visibleId, { limit: 100 })
      .then((eventItems) => {
        if (isMounted) {
          setEvents(eventItems);
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
      detailRequestIdRef.current += 1;
    };
  }, [visibleId]);

  return {
    events,
    error,
    isDetailLoading,
    isLoading,
    loadEventDetail,
    reloadEvents,
  };
}
