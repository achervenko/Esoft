import { ArrowLeft, Plus } from "lucide-react";
import type { PpePosition, PpeNorm } from "../../shared/api/ppe";
import { normPeriodStatus } from "./norm-model";
type NormPositionHeaderProps = {
  selected?: PpePosition;
  manage: boolean;
  loading: boolean;
  selectedNorms?: PpeNorm[];
  onBack: () => void;
  onCreate: () => void;
};
export function NormPositionHeader({
  selected,
  manage,
  loading,
  selectedNorms,
  onBack,
  onCreate,
}: NormPositionHeaderProps) {
  return (
    <>
      <button type="button" className="ppe-search-back" onClick={onBack}>
        <ArrowLeft size={18} aria-hidden="true" /> Назад
      </button>
      <header className="ppe-employee-header">
        <div>
          <h2>{selected?.name}</h2>
          <p>Нормы выдачи</p>
        </div>
        {manage &&
          selected?.isActive &&
          !loading &&
          selectedNorms &&
          ["MALE", "FEMALE"].some((gender) => !selectedNorms.some((norm) => norm.gender === gender && normPeriodStatus(norm) !== "Завершённая")) && (
            <button type="button" aria-label="Добавить норму" className="admin-primary-button" onClick={onCreate}>
              <Plus size={18} aria-hidden="true" />
              Добавить
            </button>
          )}
      </header>
    </>
  );
}
