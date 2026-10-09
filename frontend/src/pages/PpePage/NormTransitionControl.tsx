import { CircleHelp } from "lucide-react";

export function NormTransitionControl({
  hard,
  disabled,
  onChange,
}: {
  hard: boolean;
  disabled: boolean;
  onChange: (hard: boolean) => void;
}) {
  return (
    <div className="ppe-transition-control">
      <button
        type="button"
        role="switch"
        aria-label="Жёсткий переход"
        aria-checked={hard}
        disabled={disabled}
        className="ppe-transition-switch"
        onClick={() => onChange(!hard)}
      >
        <span />
      </button>
      <span>Жёсткий переход</span>
      <details className="ppe-transition-help">
        <summary aria-label="Как работают переходы">
          <CircleHelp size={17} aria-hidden="true" />
        </summary>
        <div className="ppe-transition-tip">
          <p>
            <strong>Выключено — мягкий переход.</strong> Ранее выданные СИЗ
            сохраняют старый срок. После его окончания применяется новая норма.
          </p>
          <p>
            <strong>Включено — жёсткий переход.</strong> Новая периодичность
            применяется сразу. Если новый срок носки уже истёк, доступна одна
            выдача.
          </p>
          <p>
            Месячный объём считается с месяца перехода, без доначислений за
            прошлые месяцы. Уже выданное в текущем месяце засчитывается: если
            положено 10 пар, а выдано 5, доступны ещё 5.
          </p>
        </div>
      </details>
    </div>
  );
}
