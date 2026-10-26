import { CheckboxFilterModal } from "../../shared/ui/CheckboxFilterModal";
const options = [
  { value: "true", label: "Активные" },
  { value: "false", label: "Неактивные" },
];
export function StorageLocationsFiltersModal({
  active,
  onApply,
  onClose,
}: {
  active: string;
  onApply: (value: string) => void;
  onClose: () => void;
}) {
  return (
    <CheckboxFilterModal
      title="Настройки поиска"
      legend="Статус"
      options={options}
      values={active ? [active] : []}
      onApply={(values) => onApply(values[0] ?? "")}
      onClose={onClose}
    />
  );
}
