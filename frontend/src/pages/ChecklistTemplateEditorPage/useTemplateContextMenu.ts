import { useCallback, useEffect, useRef, useState } from "react";
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import type {
  TemplateStructureMenuState,
  TemplateStructureTarget,
} from "./template-structure.types";

const MENU_WIDTH = 190;
const MENU_VERTICAL_PADDING = 12;
const MENU_ITEM_HEIGHT = 38;
const LONG_PRESS_MS = 520;
const LONG_PRESS_MOVE_THRESHOLD_PX = 8;
const SUPPRESS_NEXT_CLICK_MS = 400;

type UseTemplateContextMenuParams = {
  enabled: boolean;
  onOpenMenu?: () => void;
  onRequestDelete: (target: TemplateStructureTarget) => void;
};

export function useTemplateContextMenu({
  enabled,
  onOpenMenu,
  onRequestDelete,
}: UseTemplateContextMenuParams) {
  const [menu, setMenu] = useState<TemplateStructureMenuState>(null);
  const longPressTimeoutRef = useRef<number | null>(null);
  const longPressStartRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTriggeredRef = useRef(false);
  const suppressNextClickRef = useRef(false);
  const suppressNextClickTargetRef = useRef<HTMLElement | null>(null);
  const suppressNextClickTimeoutRef = useRef<number | null>(null);

  const clearLongPress = useCallback(() => {
    if (longPressTimeoutRef.current !== null) {
      window.clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }

    longPressStartRef.current = null;
  }, []);

  const resetLongPress = useCallback(() => {
    clearLongPress();
    longPressTriggeredRef.current = false;
  }, [clearLongPress]);

  const clearSuppressNextClick = useCallback(() => {
    if (suppressNextClickTimeoutRef.current !== null) {
      window.clearTimeout(suppressNextClickTimeoutRef.current);
      suppressNextClickTimeoutRef.current = null;
    }

    suppressNextClickRef.current = false;
    suppressNextClickTargetRef.current = null;
  }, []);

  const suppressNextClick = useCallback((target: HTMLElement) => {
    clearSuppressNextClick();
    suppressNextClickRef.current = true;
    suppressNextClickTargetRef.current = target;
    suppressNextClickTimeoutRef.current = window.setTimeout(() => {
      suppressNextClickRef.current = false;
      suppressNextClickTargetRef.current = null;
      suppressNextClickTimeoutRef.current = null;
    }, SUPPRESS_NEXT_CLICK_MS);
  }, [clearSuppressNextClick]);

  const closeMenu = useCallback(() => {
    clearLongPress();
    setMenu(null);
  }, [clearLongPress]);

  const openMenu = useCallback(
    (target: TemplateStructureTarget, clientX: number, clientY: number) => {
      if (!enabled) {
        return;
      }

      const x = Math.min(
        Math.max(8, clientX),
        Math.max(8, window.innerWidth - MENU_WIDTH - 8),
      );
      const menuHeight = getMenuHeight(target);
      const y = Math.min(
        Math.max(8, clientY),
        Math.max(8, window.innerHeight - menuHeight - 8),
      );

      onOpenMenu?.();
      setMenu({ target, x, y });
    },
    [enabled, onOpenMenu],
  );

  const requestMenuDelete = useCallback(() => {
    if (!menu) {
      return;
    }

    const target = menu.target;
    setMenu(null);
    onRequestDelete(target);
  }, [menu, onRequestDelete]);

  const getTargetProps = useCallback(
    (target: TemplateStructureTarget) => ({
      onContextMenu: (event: ReactMouseEvent<HTMLElement>) => {
        if (!enabled) {
          return;
        }

        event.preventDefault();

        if (isCheckboxTarget(event.target)) {
          event.stopPropagation();
          closeMenu();
          return;
        }

        event.stopPropagation();
        openMenu(target, event.clientX, event.clientY);
      },
      onPointerCancel: resetLongPress,
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
        if (!enabled || event.pointerType !== "touch") {
          return;
        }

        if (isCheckboxTarget(event.target)) {
          return;
        }

        const { clientX, clientY } = event;
        clearLongPress();
        longPressTriggeredRef.current = false;
        longPressStartRef.current = { x: clientX, y: clientY };
        longPressTimeoutRef.current = window.setTimeout(() => {
          longPressTimeoutRef.current = null;
          longPressStartRef.current = null;
          longPressTriggeredRef.current = true;
          openMenu(target, clientX, clientY);
        }, LONG_PRESS_MS);
      },
      onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
        const start = longPressStartRef.current;

        if (!start) {
          return;
        }

        const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y);

        if (distance > LONG_PRESS_MOVE_THRESHOLD_PX) {
          resetLongPress();
        }
      },
      onPointerUp: (event: ReactPointerEvent<HTMLElement>) => {
        const wasLongPress = longPressTriggeredRef.current;
        resetLongPress();

        if (!wasLongPress) {
          return;
        }

        suppressNextClick(event.currentTarget);
        event.preventDefault();
        event.stopPropagation();
      },
    }),
    [
      clearLongPress,
      closeMenu,
      enabled,
      openMenu,
      resetLongPress,
      suppressNextClick,
    ],
  );

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest(".checklist-structure-context-menu")
      ) {
        return;
      }

      setMenu(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        resetLongPress();
        setMenu(null);
      }
    };
    const handleScroll = () => {
      resetLongPress();
      setMenu(null);
    };
    const handleClick = (event: MouseEvent) => {
      if (!suppressNextClickRef.current) {
        return;
      }

      if (
        !(event.target instanceof Node) ||
        !suppressNextClickTargetRef.current?.contains(event.target)
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      clearSuppressNextClick();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("click", handleClick, true);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, true);
      resetLongPress();
      clearSuppressNextClick();
    };
  }, [clearSuppressNextClick, resetLongPress]);

  return {
    closeMenu,
    getTargetProps,
    menu,
    openMenu,
    requestMenuDelete,
  };
}

function isCheckboxTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest(".app-checkbox"));
}

function getMenuHeight(target: TemplateStructureTarget) {
  const itemsCount = target.kind === "module" ? 2 : 1;
  return MENU_VERTICAL_PADDING + MENU_ITEM_HEIGHT * itemsCount;
}
