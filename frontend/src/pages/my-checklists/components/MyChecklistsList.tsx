import { MyChecklistCard } from "./MyChecklistCard";
import type { MyChecklistsListProps } from "../my-checklists.types";

export function MyChecklistsList({ getChecklistHref, isLoading, items }: MyChecklistsListProps) {
  return (
    <section className="my-checklists-list" aria-busy={isLoading}>
      {isLoading ? (
        <p className="admin-state">Загрузка чек-листов...</p>
      ) : items.length === 0 ? (
        <p className="my-checklists-empty">В этой вкладке чек-листов пока нет.</p>
      ) : (
        <div className="my-checklists-cards">
          {items.map((item) => (
            <MyChecklistCard
              href={getChecklistHref(item.id, item.status)}
              item={item}
              key={item.id}
            />
          ))}
        </div>
      )}
    </section>
  );
}
