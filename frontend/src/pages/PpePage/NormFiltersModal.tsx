import { CheckboxFilterModal } from "../../shared/ui/CheckboxFilterModal";
import { normStatusLabels, type NormCoverage } from "./norm-coverage";
export type NormStatusFilter = NormCoverage["status"][];
const options = (Object.keys(normStatusLabels) as NormStatusFilter).map(
  (value) => ({ value, label: normStatusLabels[value] }),
);
export function NormFiltersModal({
  statuses,
  onApply,
  onClose,
}: {
  statuses: NormStatusFilter;
  onApply: (statuses: NormStatusFilter) => void;
  onClose: () => void;
}) {
  return (
    <CheckboxFilterModal
      title="Фильтры норм"
      options={options}
      values={statuses}
      onApply={onApply}
      onClose={onClose}
    />
  );
}
