import { MyChecklistCard } from "./MyChecklistCard";
import type { MyChecklistsListProps } from "../my-checklists.types";

export function MyChecklistsList({
  currentUserId,
  isLoading,
  items,
  onOpen,
  onStart,
}: MyChecklistsListProps) {
  return (
    <section className="my-checklists-list" aria-busy={isLoading}>
      {isLoading ? (
        <p className="admin-state">Загрузка чек-листов...</p>
      ) : items.length === 0 ? (
        <p className="my-checklists-empty">В этой вкладке чек-листов пока нет.</p>
      ) : (
        <div className="my-checklists-items">
          {items.map((item) => (
            <MyChecklistCard
              currentUserId={currentUserId}
              item={item}
              key={item.id}
              onOpen={onOpen}
              onStart={onStart}
            />
          ))}
        </div>
      )}
    </section>
  );
}
