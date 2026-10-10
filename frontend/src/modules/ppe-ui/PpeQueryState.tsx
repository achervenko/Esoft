import { LoadingIndicator } from "../../shared/ui/LoadingIndicator";
import { Message } from "./ppe-ui";
export function PpeQueryState({
  loading,
  error,
  reload,
  page = false,
}: {
  page?: boolean;
  loading: boolean;
  error: string | null;
  reload: () => void;
}) {
  if (page)
    return (
      <>
        <LoadingIndicator loading={loading} />
        {!loading && error && (
          <div>
            <Message error={error} />
            <button type="button" className="admin-secondary-button" onClick={reload}>
              Повторить загрузку
            </button>
          </div>
        )}
      </>
    );
  if (loading)
    return (
      <p className={page ? "app-page-loading" : "admin-state"} role="status">
        Загрузка...
      </p>
    );
  if (error)
    return (
      <div>
        <Message error={error} />
        <button type="button" className="admin-secondary-button" onClick={reload}>
          Повторить загрузку
        </button>
      </div>
    );
  return null;
}
