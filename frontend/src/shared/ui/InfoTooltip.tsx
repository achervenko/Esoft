import { Portal, Tooltip } from "@chakra-ui/react";
import { Info } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import "./InfoTooltip.css";

export function InfoTooltip({
  label,
  reasons,
}: {
  label: string;
  reasons: readonly string[];
}) {
  const [open, setOpen] = useState(false);
  const pinned = useRef(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = () => {
      pinned.current = false;
      setOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !triggerRef.current?.contains(event.target) &&
        !contentRef.current?.contains(event.target)
      )
        close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <Tooltip.Root
      open={open}
      interactive
      openDelay={150}
      closeDelay={150}
      closeOnClick={false}
      closeOnPointerDown={false}
      onOpenChange={(details) => {
        if (!pinned.current) setOpen(details.open);
      }}
      positioning={{ placement: "top", gutter: 8 }}
    >
      <Tooltip.Trigger asChild>
        <button
          ref={triggerRef}
          type="button"
          className="info-tooltip-trigger"
          aria-label={label}
          onClick={(event) => {
            event.stopPropagation();
            pinned.current = !pinned.current;
            setOpen(pinned.current);
          }}
        >
          <Info size={16} aria-hidden="true" />
        </button>
      </Tooltip.Trigger>
      <Portal>
        <Tooltip.Positioner>
          <Tooltip.Content
            ref={contentRef}
            className="info-tooltip-content"
            onClick={(event) => event.stopPropagation()}
          >
            {reasons.length === 1 ? (
              reasons[0]
            ) : (
              <ul>
                {reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            )}
          </Tooltip.Content>
        </Tooltip.Positioner>
      </Portal>
    </Tooltip.Root>
  );
}
