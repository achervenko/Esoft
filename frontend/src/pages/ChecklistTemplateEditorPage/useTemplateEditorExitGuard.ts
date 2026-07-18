import { useCallback, useEffect, useRef, useState } from "react";
import {
  getCurrentHashHistoryIndex,
  markCurrentHashHistoryEntry,
} from "../../shared/lib/hash-history-marker";

type UseTemplateEditorExitGuardParams = {
  exitEditor: (href?: string) => Promise<boolean>;
  onRequestConfirmExit: () => void;
  shouldConfirmExit: () => boolean;
};

export function useTemplateEditorExitGuard({
  exitEditor,
  onRequestConfirmExit,
  shouldConfirmExit,
}: UseTemplateEditorExitGuardParams) {
  const [pendingExitHref, setPendingExitHref] = useState("#/checklist-admin");
  const currentHashRef = useRef(window.location.hash || "#/checklist-admin");
  const currentHistoryIndexRef = useRef(markCurrentHashHistoryEntry());
  const isRestoringHashRef = useRef(false);
  const restoreTimeoutRef = useRef<number | null>(null);

  const clearRestoreTimeout = useCallback(() => {
    if (restoreTimeoutRef.current !== null) {
      window.clearTimeout(restoreTimeoutRef.current);
      restoreTimeoutRef.current = null;
    }
  }, []);

  const requestExit = useCallback(
    (href = "#/checklist-admin") => {
      if (shouldConfirmExit()) {
        setPendingExitHref(href);
        onRequestConfirmExit();
        return;
      }

      void exitEditor(href);
    },
    [exitEditor, onRequestConfirmExit, shouldConfirmExit],
  );

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!shouldConfirmExit()) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [shouldConfirmExit]);

  useEffect(() => {
    currentHashRef.current = window.location.hash || "#/checklist-admin";
    currentHistoryIndexRef.current = markCurrentHashHistoryEntry();

    const handleDocumentClick = (event: MouseEvent) => {
      if (
        event.button !== 0 ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        !shouldConfirmExit()
      ) {
        return;
      }

      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      const href = anchor?.getAttribute("href");

      if (
        !anchor ||
        anchor.hasAttribute("download") ||
        (anchor.target && anchor.target !== "_self") ||
        !href?.startsWith("#/") ||
        href === currentHashRef.current
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setPendingExitHref(href);
      onRequestConfirmExit();
    };

    const handleHashChange = () => {
      const nextHash = window.location.hash || "#/checklist-admin";
      const nextHistoryIndex =
        getCurrentHashHistoryIndex() ?? markCurrentHashHistoryEntry();

      if (isRestoringHashRef.current) {
        isRestoringHashRef.current = false;
        clearRestoreTimeout();
        currentHashRef.current = nextHash;
        currentHistoryIndexRef.current = nextHistoryIndex;
        return;
      }

      if (!shouldConfirmExit()) {
        currentHashRef.current = nextHash;
        currentHistoryIndexRef.current = nextHistoryIndex;
        return;
      }

      setPendingExitHref(nextHash);
      onRequestConfirmExit();
      const restoreDelta = getHistoryRestoreDelta(
        currentHistoryIndexRef.current,
        nextHistoryIndex,
      );

      if (restoreDelta === 0) {
        return;
      }

      isRestoringHashRef.current = true;
      clearRestoreTimeout();
      restoreTimeoutRef.current = window.setTimeout(() => {
        isRestoringHashRef.current = false;
        restoreTimeoutRef.current = null;
      }, 800);
      window.history.go(restoreDelta);
    };

    document.addEventListener("click", handleDocumentClick, true);
    window.addEventListener("hashchange", handleHashChange);

    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
      window.removeEventListener("hashchange", handleHashChange);
      clearRestoreTimeout();
    };
  }, [clearRestoreTimeout, onRequestConfirmExit, shouldConfirmExit]);

  return {
    pendingExitHref,
    requestExit,
  };
}

function getHistoryRestoreDelta(
  currentIndex: number,
  nextIndex: number,
) {
  if (nextIndex > currentIndex) {
    return -1;
  }

  if (nextIndex < currentIndex) {
    return 1;
  }

  return 0;
}
