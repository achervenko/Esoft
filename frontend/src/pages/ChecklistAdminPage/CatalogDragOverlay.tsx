import { GripVertical } from "lucide-react";
import type { CatalogDragState } from "./catalog-reorder.types";

type CatalogDragOverlayProps = {
  dragState: CatalogDragState;
  setOverlayRef: (element: HTMLDivElement | null) => void;
};

export function CatalogDragOverlay({
  dragState,
  setOverlayRef,
}: CatalogDragOverlayProps) {
  if (!dragState) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className={`checklist-order-drag-overlay ${dragState.kind}`}
      ref={setOverlayRef}
      style={{
        transform: `translate3d(${dragState.x + 12}px, ${dragState.y + 12}px, 0)`,
      }}
    >
      <GripVertical aria-hidden="true" size={18} />
      <span>
        <strong>{dragState.title}</strong>
        <small>{dragState.subtitle}</small>
      </span>
    </div>
  );
}
