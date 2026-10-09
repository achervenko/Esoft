import { AppTable } from "../../shared/ui/AppTable";
import "../../modules/ppe-ui/PpeLayout.css";
import type { PpeItem, PpeSize } from "../../shared/api/ppe";
type SizeListTableProps = {
  item: PpeItem;
  manage: boolean;
  saving: boolean;
  onEdit: (size: PpeSize) => void;
  onToggle: (size: PpeSize) => void;
};
export function SizeListTable({
  item,
  manage,
  saving,
  onEdit,
  onToggle,
}: SizeListTableProps) {
  return (
    <div className="ppe-table-wrap">
      <AppTable>
        <thead>
          <tr>
            <th>Размер</th>
            {item.type === "BODY" && <th>Ростовка</th>}
            <th>Статус</th>
            <th className="admin-table-actions-column">Действия</th>
          </tr>
        </thead>
        <tbody>
          {item.sizes.map((size) => (
            <tr
              key={size.id}
              className={!size.isActive ? "ppe-inactive" : undefined}
            >
              <td>{size.value}</td>
              {item.type === "BODY" && <td>{size.heightValue}</td>}
              <td>{size.isActive ? "Активен" : "Отключён"}</td>
              <td className="admin-table-actions-column">
                {manage && (
                  <div className="admin-table-actions">
                    <button disabled={saving} onClick={() => onEdit(size)}>
                      Изменить
                    </button>
                    <button disabled={saving} onClick={() => onToggle(size)}>
                      {size.isActive ? "Отключить" : "Включить"}
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </AppTable>
    </div>
  );
}
