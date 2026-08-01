import { ArrowRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getEquipmentProgressDashboard } from "./equipment-progress-dashboard.api";
import type { EquipmentProgressDashboardDto } from "./equipment-progress-dashboard.types";
import "./EquipmentProgressDashboard.css";

type DashboardState =
  | { data: EquipmentProgressDashboardDto; error: null; isLoading: false }
  | { data: null; error: null; isLoading: true }
  | { data: null; error: string; isLoading: false };

export function EquipmentProgressDashboard() {
  const [state, setState] = useState<DashboardState>({
    data: null,
    error: null,
    isLoading: true,
  });

  useEffect(() => {
    let isMounted = true;

    setState({ data: null, error: null, isLoading: true });

    getEquipmentProgressDashboard()
      .then((data) => {
        if (isMounted) {
          setState({ data, error: null, isLoading: false });
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setState({
            data: null,
            error:
              error instanceof Error
                ? error.message
                : "Не удалось загрузить прогресс наполнения.",
            isLoading: false,
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (state.isLoading) {
    return (
      <section className="equipment-progress-dashboard-state">
        Загрузка прогресса наполнения...
      </section>
    );
  }

  if (state.error) {
    return (
      <section className="equipment-progress-dashboard-state error">
        {state.error}
      </section>
    );
  }

  if (!state.data) {
    return null;
  }

  return <EquipmentProgressDashboardContent data={state.data} />;
}

function EquipmentProgressDashboardContent({
  data,
}: {
  data: EquipmentProgressDashboardDto;
}) {
  const maxDailyCount = useMemo(
    () =>
      Math.max(
        1,
        ...data.recentDailyCounts.map((dailyCount) => dailyCount.count),
      ),
    [data.recentDailyCounts],
  );

  return (
    <section
      aria-label="Прогресс наполнения оборудования"
      className="equipment-progress-dashboard"
    >
      <div className="equipment-progress-dashboard-grid">
        <article className="equipment-progress-card equipment-progress-card-main">
          <div className="equipment-progress-card-heading">
            <span>Общий прогресс наполнения</span>
          </div>
          <ProgressGauge percent={data.progressPercent} />
          <dl className="equipment-progress-summary">
            <div>
              <dt>Создано</dt>
              <dd>
                {data.createdCount} из {data.targetCount}
              </dd>
            </div>
            <div>
              <dt>Осталось создать</dt>
              <dd>{data.remainingCount}</dd>
            </div>
          </dl>
        </article>

        <article className="equipment-progress-card equipment-progress-stats-card">
          <div className="equipment-progress-stat completed">
            <div>
              <span>Полностью заполненные карточки</span>
              <strong>{data.completedCardsCount}</strong>
            </div>
          </div>
          <div className="equipment-progress-stat incomplete">
            <div>
              <span>Требуют заполнения</span>
              <strong>{data.incompleteCardsCount}</strong>
            </div>
          </div>
        </article>

        <article className="equipment-progress-card equipment-progress-dynamics-card">
          <div className="equipment-progress-card-heading">
            <span>Динамика создания за 7 дней</span>
            <strong>{data.recentCreatedCount}</strong>
          </div>
          <div className="equipment-progress-bars">
            {data.recentDailyCounts.map((dailyCount) => (
              <div
                className="equipment-progress-bar-item"
                key={dailyCount.date}
              >
                <span
                  className="equipment-progress-bar"
                  style={{
                    height:
                      dailyCount.count === 0
                        ? "0%"
                        : `${Math.max(
                            8,
                            (dailyCount.count / maxDailyCount) * 100,
                          )}%`,
                  }}
                />
                <strong>{dailyCount.count}</strong>
                <small>{formatShortDate(dailyCount.date)}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="equipment-progress-card equipment-progress-forecast-card">
          <div className="equipment-progress-card-heading">
            <span>Прогноз создания карточек</span>
          </div>
          <dl className="equipment-progress-forecast">
            <div>
              <dt>Темп создания</dt>
              <dd>{data.averageCreatedPerDay} в день</dd>
            </div>
            <div>
              <dt>До завершения</dt>
              <dd>
                {data.estimatedDaysRemaining === null
                  ? "Недостаточно данных"
                  : formatDays(data.estimatedDaysRemaining)}
              </dd>
            </div>
            <div>
              <dt>Ориентир</dt>
              <dd>
                {data.estimatedCompletionDate
                  ? formatDate(data.estimatedCompletionDate)
                  : "Недостаточно данных для прогноза"}
              </dd>
            </div>
          </dl>
        </article>
      </div>

      <article className="equipment-progress-card equipment-progress-incomplete-card">
        <div className="equipment-progress-card-heading">
          <span>Первые не до конца заполненные карточки</span>
          <strong>
            показано {data.incompleteEquipment.length} из{" "}
            {data.incompleteCardsCount}
          </strong>
        </div>

        {data.incompleteEquipment.length > 0 ? (
          <ul className="equipment-progress-incomplete-list">
            {data.incompleteEquipment.map((equipment) => (
              <li key={equipment.visibleId}>
                <a href={`#/equipment/${equipment.visibleId}`}>
                  <div>
                    <strong>
                      ID {equipment.visibleId} — {equipment.name}
                    </strong>
                    <span>{equipment.missingFields.join(", ")}</span>
                  </div>
                  <ArrowRight aria-hidden="true" size={18} />
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="equipment-progress-empty">
            Все созданные карточки заполнены по текущему критерию.
          </p>
        )}
      </article>
    </section>
  );
}

function ProgressGauge({ percent }: { percent: number }) {
  const clampedPercent = Math.max(0, Math.min(percent, 100));
  const angle = -90 + clampedPercent * 1.8;

  return (
    <div
      aria-label={`Общий прогресс наполнения ${clampedPercent}%`}
      className="equipment-progress-gauge"
      role="img"
    >
      <svg viewBox="0 0 240 142">
        <defs>
          <linearGradient
            gradientUnits="userSpaceOnUse"
            id="equipment-progress-gauge-gradient"
            x1="28"
            x2="212"
            y1="118"
            y2="118"
          >
            <stop offset="0%" stopColor="#dc2626" />
            <stop offset="52%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#10a37f" />
          </linearGradient>
        </defs>
        <path
          className="equipment-progress-gauge-track"
          d="M 28 118 A 92 92 0 0 1 212 118"
          pathLength="100"
        />
        <path
          className="equipment-progress-gauge-value"
          d="M 28 118 A 92 92 0 0 1 212 118"
          pathLength="100"
          style={{ strokeDasharray: `${clampedPercent} 100` }}
        />
        <line
          className="equipment-progress-gauge-needle"
          transform={`rotate(${angle} 120 118)`}
          x1="120"
          x2="120"
          y1="118"
          y2="38"
        />
        <circle
          className="equipment-progress-gauge-center"
          cx="120"
          cy="118"
          r="7"
        />
      </svg>
      <strong>{clampedPercent}%</strong>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00.000`));
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(`${value}T00:00:00.000`));
}

function formatDays(value: number) {
  if (value === 0) {
    return "цель достигнута";
  }

  return `${value} ${getDayWord(value)}`;
}

function getDayWord(value: number) {
  const lastTwoDigits = value % 100;
  const lastDigit = value % 10;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return "дней";
  }

  if (lastDigit === 1) {
    return "день";
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return "дня";
  }

  return "дней";
}
