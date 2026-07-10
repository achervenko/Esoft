import { TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import './UnsavedChangesGuard.css';

type UnsavedChangesGuardProps = {
  hasChanges: boolean;
};

export function UnsavedChangesGuard({ hasChanges }: UnsavedChangesGuardProps) {
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasChanges) {
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
    setPendingHref(null);

    if (nextHref.startsWith('#')) {
      window.location.hash = nextHref;
      return;
    }

    window.location.href = nextHref;
  };

  return (
    <div
      aria-labelledby="unsaved-changes-title"
      aria-modal="true"
      className="unsaved-changes-backdrop"
      role="dialog"
    >
      <div className="unsaved-changes-dialog">
        <div className="unsaved-changes-message">
          <TriangleAlert aria-hidden="true" size={26} />
          <div>
            <h2 id="unsaved-changes-title">Есть несохраненные изменения</h2>
            <p>Выйти без сохранения?</p>
          </div>
        </div>

        <div className="unsaved-changes-actions">
          <button
            className="unsaved-changes-secondary"
            onClick={closeDialog}
            type="button"
          >
            Остаться
          </button>
          <button
            className="unsaved-changes-primary"
            onClick={leavePage}
            type="button"
          >
            Выйти
          </button>
        </div>
      </div>
    </div>
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
