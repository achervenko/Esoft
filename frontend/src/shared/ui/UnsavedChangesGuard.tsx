import { useEffect, useRef, useState, type ReactNode } from "react";
import { ConfirmDialog } from "./ConfirmDialog";

type UnsavedChangesGuardProps = {
  hasChanges: boolean;
  isBlocked?: boolean;
  children?: (requestLeave: (action: () => void) => void) => ReactNode;
};

export function UnsavedChangesGuard({
  hasChanges,
  children,
  isBlocked = false,
}: UnsavedChangesGuardProps) {
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const requestLeave = (action: () => void) => {
    if (isBlocked) return;
    if (hasChanges) setPendingAction(() => action);
    else action();
  };
  const isConfirmedNavigationRef = useRef(false);

  useEffect(() => {
    if (isBlocked) {
      setPendingHref(null);
      setPendingAction(null);
    }
  }, [isBlocked]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if ((!hasChanges && !isBlocked) || isConfirmedNavigationRef.current) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasChanges, isBlocked]);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if ((!hasChanges && !isBlocked) || event.defaultPrevented) {
        return;
      }

      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const link = target.closest("a[href]");

      if (!(link instanceof HTMLAnchorElement)) {
        return;
      }

      if (
        link.target ||
        event.button !== 0 ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      ) {
        return;
      }

      const href = link.getAttribute("href");

      if (!href || isSameAppLocation(href)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      if (!isBlocked) setPendingHref(href);
    };

    document.addEventListener("click", handleDocumentClick, true);

    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [hasChanges, isBlocked]);

  const closeDialog = () => {
    setPendingHref(null);
    setPendingAction(null);
  };

  const leavePage = () => {
    if (isBlocked) return;
    if (pendingAction) {
      const action = pendingAction;
      setPendingAction(null);
      action();
      return;
    }
    const nextHref = pendingHref;
    if (!nextHref) return;
    isConfirmedNavigationRef.current = true;
    setPendingHref(null);

    if (nextHref.startsWith("#")) {
      window.location.hash = nextHref;
      isConfirmedNavigationRef.current = false;
      return;
    }

    try {
      window.location.href = nextHref;
    } catch (error) {
      isConfirmedNavigationRef.current = false;
      throw error;
    }
  };

  return (
    <>
      {children?.(requestLeave)}
      {(pendingHref || pendingAction) && (
        <ConfirmDialog
          cancelLabel="Остаться"
          confirmLabel="Выйти"
          description="Выйти без сохранения?"
          onCancel={closeDialog}
          onConfirm={leavePage}
          title="Есть несохраненные изменения"
          variant="danger"
        />
      )}
    </>
  );
}

function isSameAppLocation(href: string) {
  if (href.startsWith("#")) {
    return href === window.location.hash;
  }

  try {
    return new URL(href, window.location.href).href === window.location.href;
  } catch {
    return false;
  }
}
