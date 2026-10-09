import { Message } from "./ppe-ui";
export function PpeQueryState({
  loading,
  error,
  reload,
}: {
  loading: boolean;
  error: string | null;
  reload: () => void;
}) {
  if (loading)
    return (
      <p className="admin-state" role="status">
        Загрузка...
      </p>
    );
  if (error)
    return (
      <div>
        <Message error={error} />
        <button className="admin-secondary-button" onClick={reload}>
          Повторить загрузку
        </button>
      </div>
    );
  return null;
}
