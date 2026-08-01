import { useCallback, useEffect, useRef, useState } from "react";
import { getEvent, getEvents } from "../../shared/api/events/events.api";
import type { EquipmentEventItem } from "./equipment-events.types";
import { getApiErrorMessage } from "../../shared/api/api-error";
import {
  assertEquipmentEventDetail,
  assertEquipmentEventItem,
  toEquipmentEventDetail,
  toEquipmentEventItem,
} from "./equipment-events.mappers";

export function useEquipmentEventsList(visibleId: number) {
  const [events, setEvents] = useState<EquipmentEventItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const detailRequestIdRef = useRef(0);

  const reloadEvents = useCallback(async () => {
    setListError(null);

    try {
      const eventItems = await loadEquipmentEvents(visibleId);
      setEvents(eventItems);
      return eventItems;
    } catch (requestError) {
      setListError(getApiErrorMessage(requestError));
      throw requestError;
    }
  }, [visibleId]);

  const loadEventDetail = useCallback(async (eventId: number) => {
    const requestId = detailRequestIdRef.current + 1;
    detailRequestIdRef.current = requestId;

    setIsDetailLoading(true);
    setDetailError(null);

    try {
      const event = await getEvent(eventId);

      assertEquipmentEventDetail(event);
      const eventDetail = toEquipmentEventDetail(event);

      if (detailRequestIdRef.current !== requestId) {
        return null;
      }

      return eventDetail;
    } catch (requestError) {
      if (detailRequestIdRef.current === requestId) {
        setDetailError(getApiErrorMessage(requestError));
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
    setListError(null);

    loadEquipmentEvents(visibleId)
      .then((eventItems) => {
        if (isMounted) {
          setEvents(eventItems);
        }
      })
      .catch((requestError) => {
        if (isMounted) {
          setListError(getApiErrorMessage(requestError));
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
    detailError,
    events,
    isDetailLoading,
    isLoading,
    listError,
    loadEventDetail,
    reloadEvents,
  };
}

async function loadEquipmentEvents(visibleId: number) {
  const events = await getEvents({
    equipmentVisibleId: visibleId,
    extensionCode: "EQUIPMENT",
    limit: 100,
  });

  return events.map((event) => {
    assertEquipmentEventItem(event);

    return toEquipmentEventItem(event);
  });
}
