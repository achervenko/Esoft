import { formatQuestionCount } from "../../shared/lib/formatters";

type CatalogUnassignedCardProps = {
  isSelected: boolean;
  onSelect: () => void;
  questionCount: number;
};

export function CatalogUnassignedCard({
  isSelected,
  onSelect,
  questionCount,
}: CatalogUnassignedCardProps) {
  return (
    <button
      className={`checklist-catalog-unassigned${isSelected ? " selected" : ""}`}
      onClick={onSelect}
      type="button"
    >
      <strong>Без модуля</strong>
      <small>{formatQuestionCount(questionCount)}</small>
    </button>
  );
}
