import { useCallback, useRef, useState } from "react";
import type { EquipmentEventItem } from "./equipment-events.types";
import type { EquipmentEventsPanelModalState } from "./equipment-events-panel.types";

type UseEquipmentEventDetailParams = {
  initialEventId?: number | null;
  loadEventDetail: (
    eventId: number,
  ) => Promise<EquipmentEventsPanelModalState["detailEvent"]>;
};

export function useEquipmentEventDetail({
  initialEventId = null,
  loadEventDetail,
}: UseEquipmentEventDetailParams) {
  const [detailEvent, setDetailEvent] =
    useState<EquipmentEventsPanelModalState["detailEvent"]>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(
    () => initialEventId !== null,
  );
  const latestDetailEventIdRef = useRef<number | null>(initialEventId);

  const openDetailById = useCallback(async (eventId: number) => {
    latestDetailEventIdRef.current = eventId;
    setIsDetailOpen(true);
    setDetailEvent(null);

    const eventDetail = await loadEventDetail(eventId);

    if (
      latestDetailEventIdRef.current === eventId &&
      eventDetail?.id === eventId
    ) {
      setDetailEvent(eventDetail);
    }
  }, [loadEventDetail]);

  const handleOpenDetail = useCallback((event: EquipmentEventItem) => {
    return openDetailById(event.id);
  }, [openDetailById]);

  const resetDetail = useCallback(() => {
    setIsDetailOpen(false);
    setDetailEvent(null);
    latestDetailEventIdRef.current = null;
  }, []);

  return {
    closeDetail: resetDetail,
    detailEvent,
    handleOpenDetail,
    isDetailOpen,
    openDetailById,
    resetDetail,
  };
}
