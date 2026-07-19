import type { MyChecklistsListProps } from "../my-checklists.types";
import { MyChecklistCard } from "./MyChecklistCard";

export function MyChecklistsList({
  getChecklistHref,
  isLoading,
  items,
  onStartChecklist,
  startingChecklistId,
}: MyChecklistsListProps) {
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
              isStarting={startingChecklistId === item.id}
              item={item}
              key={item.id}
              onStart={onStartChecklist}
            />
          ))}
        </div>
      )}
    </section>
  );
}
