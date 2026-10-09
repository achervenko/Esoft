import { ArrowLeft } from "lucide-react";
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
          !selectedNorms.some(
            (norm) => normPeriodStatus(norm) !== "Завершённая",
          ) && (
            <button className="admin-primary-button" onClick={() => onCreate()}>
              Создать норму
            </button>
          )}
      </header>
    </>
  );
}
