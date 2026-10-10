import { useEffect, useRef, useState } from "react";
import "./LoadingIndicator.css";

export function LoadingIndicator({
  loading,
  children = "Загрузка...",
}: {
  loading: boolean;
  children?: React.ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const shownAt = useRef(0);
  useEffect(() => {
    if (!loading && !shownAt.current) return;
    let fadeTimer: ReturnType<typeof setTimeout> | undefined;
    const timer = setTimeout(
      () => {
        if (loading) {
          shownAt.current = Date.now();
          setLeaving(false);
          setVisible(true);
        } else {
          setLeaving(true);
          fadeTimer = setTimeout(() => {
            shownAt.current = 0;
            setVisible(false);
          }, 180);
        }
      },
      loading
        ? shownAt.current > 0
          ? 0
          : 120
        : Math.max(0, 300 - (Date.now() - shownAt.current)),
    );
    return () => {
      clearTimeout(timer);
      clearTimeout(fadeTimer);
    };
  }, [loading]);
  if (!loading && !visible) return null;
  return (
    <div className="loading-indicator" aria-busy={loading}>
      {visible && (
        <span role="status" className={leaving ? "leaving" : undefined}>
          {children}
        </span>
      )}
    </div>
  );
}
