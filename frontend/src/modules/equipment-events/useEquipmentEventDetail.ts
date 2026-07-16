import { useCallback, useRef, useState } from "react";
import type { EquipmentEventItem } from "../../shared/api/equipment-events/equipment-events.types";
import type { EquipmentEventsPanelModalState } from "./equipment-events-panel.types";

type UseEquipmentEventDetailParams = {
  loadEventDetail: (
    eventId: number,
  ) => Promise<EquipmentEventsPanelModalState["detailEvent"]>;
};

export function useEquipmentEventDetail({
  loadEventDetail,
}: UseEquipmentEventDetailParams) {
  const [detailEvent, setDetailEvent] =
    useState<EquipmentEventsPanelModalState["detailEvent"]>(null);
  const latestDetailEventIdRef = useRef<number | null>(null);

  const handleOpenDetail = useCallback(async (event: EquipmentEventItem) => {
    latestDetailEventIdRef.current = event.id;
    setDetailEvent(null);

    const eventDetail = await loadEventDetail(event.id);

    if (
      latestDetailEventIdRef.current === event.id &&
      eventDetail?.id === event.id
    ) {
      setDetailEvent(eventDetail);
    }
  }, [loadEventDetail]);

  const resetDetail = useCallback(() => {
    setDetailEvent(null);
    latestDetailEventIdRef.current = null;
  }, []);

  return {
    closeDetail: resetDetail,
    detailEvent,
    handleOpenDetail,
    resetDetail,
  };
}
