import { useEffect, useRef, useState } from 'react';
import { ConfirmDialog } from './ConfirmDialog';

type UnsavedChangesGuardProps = {
  hasChanges: boolean;
};

export function UnsavedChangesGuard({ hasChanges }: UnsavedChangesGuardProps) {
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const isConfirmedNavigationRef = useRef(false);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasChanges || isConfirmedNavigationRef.current) {
        return;
      }

      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasChanges]);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (!hasChanges || event.defaultPrevented) {
        return;
      }

      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const link = target.closest('a[href]');

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

      const href = link.getAttribute('href');

      if (!href || isSameAppLocation(href)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setPendingHref(href);
    };

    document.addEventListener('click', handleDocumentClick, true);

    return () => {
      document.removeEventListener('click', handleDocumentClick, true);
    };
  }, [hasChanges]);

  if (!pendingHref) {
    return null;
  }

  const closeDialog = () => {
    setPendingHref(null);
  };

  const leavePage = () => {
    const nextHref = pendingHref;
    isConfirmedNavigationRef.current = true;
    setPendingHref(null);

    if (nextHref.startsWith('#')) {
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
    <ConfirmDialog
      cancelLabel="Остаться"
      confirmLabel="Выйти"
      description="Выйти без сохранения?"
      onCancel={closeDialog}
      onConfirm={leavePage}
      title="Есть несохраненные изменения"
      variant="danger"
    />
  );
}

function isSameAppLocation(href: string) {
  if (href.startsWith('#')) {
    return href === window.location.hash;
  }

  try {
    return new URL(href, window.location.href).href === window.location.href;
  } catch {
    return false;
  }
}
