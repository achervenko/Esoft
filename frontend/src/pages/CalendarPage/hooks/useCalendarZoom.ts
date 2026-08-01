import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CalendarViewMode,
  CalendarZoomDirection,
} from "../model/calendar-page.types";
import { getCalendarZoomViewMode } from "../model/calendar-page.utils";

type UseCalendarZoomParams = {
  onReset: () => void;
  onZoom: (direction: CalendarZoomDirection) => void;
  viewMode: CalendarViewMode;
};

export function useCalendarZoom({
  onReset,
  onZoom,
  viewMode,
}: UseCalendarZoomParams) {
  const [zoomAnimation, setZoomAnimation] =
    useState<CalendarZoomDirection | null>(null);
  const zoomAnimationTimerRef = useRef<number | null>(null);
  const lastWheelZoomAtRef = useRef(0);

  useEffect(() => {
    return () => {
      if (zoomAnimationTimerRef.current !== null) {
        window.clearTimeout(zoomAnimationTimerRef.current);
      }
    };
  }, []);

  const zoomCalendar = useCallback(
    (direction: CalendarZoomDirection) => {
      const nextMode = getCalendarZoomViewMode(viewMode, direction);

      if (nextMode === viewMode) {
        return;
      }

      setZoomAnimation(direction);
      onZoom(direction);

      if (zoomAnimationTimerRef.current !== null) {
        window.clearTimeout(zoomAnimationTimerRef.current);
      }

      zoomAnimationTimerRef.current = window.setTimeout(() => {
        setZoomAnimation(null);
        zoomAnimationTimerRef.current = null;
      }, 220);
    },
    [onZoom, viewMode],
  );

  const resetCalendarZoom = useCallback(() => {
    if (viewMode === "month") {
      return;
    }

    setZoomAnimation("out");
    onReset();

    if (zoomAnimationTimerRef.current !== null) {
      window.clearTimeout(zoomAnimationTimerRef.current);
    }

    zoomAnimationTimerRef.current = window.setTimeout(() => {
      setZoomAnimation(null);
      zoomAnimationTimerRef.current = null;
    }, 220);
  }, [onReset, viewMode]);

  useEffect(() => {
    const handleDocumentWheel = (event: WheelEvent) => {
      if (!event.ctrlKey || event.deltaY === 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const now = window.performance.now();

      if (now - lastWheelZoomAtRef.current < 180) {
        return;
      }

      lastWheelZoomAtRef.current = now;
      zoomCalendar(event.deltaY < 0 ? "in" : "out");
    };

    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey || !isBrowserZoomShortcut(event)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (isZoomInShortcut(event)) {
        zoomCalendar("in");
        return;
      }

      if (isZoomOutShortcut(event)) {
        zoomCalendar("out");
        return;
      }

      if (isZoomResetShortcut(event)) {
        resetCalendarZoom();
      }
    };

    document.addEventListener("wheel", handleDocumentWheel, {
      capture: true,
      passive: false,
    });
    document.addEventListener("keydown", handleDocumentKeyDown, {
      capture: true,
    });

    return () => {
      document.removeEventListener("wheel", handleDocumentWheel, {
        capture: true,
      });
      document.removeEventListener("keydown", handleDocumentKeyDown, {
        capture: true,
      });
    };
  }, [resetCalendarZoom, zoomCalendar]);

  return { zoomAnimation };
}

function isBrowserZoomShortcut(event: KeyboardEvent) {
  return (
    isZoomInShortcut(event) ||
    isZoomOutShortcut(event) ||
    isZoomResetShortcut(event)
  );
}

function isZoomInShortcut(event: KeyboardEvent) {
  return (
    event.key === "+" ||
    event.key === "=" ||
    event.code === "Equal" ||
    event.code === "NumpadAdd"
  );
}

function isZoomOutShortcut(event: KeyboardEvent) {
  return (
    event.key === "-" ||
    event.key === "_" ||
    event.code === "Minus" ||
    event.code === "NumpadSubtract"
  );
}

function isZoomResetShortcut(event: KeyboardEvent) {
  return (
    event.key === "0" ||
    event.code === "Digit0" ||
    event.code === "Numpad0"
  );
}
