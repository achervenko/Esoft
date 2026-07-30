import { ChevronLeft, ChevronRight } from "lucide-react";
import "./YearSwitcher.css";

type YearSwitcherProps = {
  canGoToNextYear: boolean;
  canGoToPreviousYear: boolean;
  onNextYear: () => void;
  onPreviousYear: () => void;
  year: number;
};

export function YearSwitcher({
  canGoToNextYear,
  canGoToPreviousYear,
  onNextYear,
  onPreviousYear,
  year,
}: YearSwitcherProps) {
  return (
    <div aria-label="Выбор года" className="production-calendar-year-switcher">
      <button
        aria-label="Предыдущий год"
        disabled={!canGoToPreviousYear}
        onClick={onPreviousYear}
        type="button"
      >
        <ChevronLeft size={18} />
      </button>
      <span>{year}</span>
      <button
        aria-label="Следующий год"
        disabled={!canGoToNextYear}
        onClick={onNextYear}
        type="button"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
