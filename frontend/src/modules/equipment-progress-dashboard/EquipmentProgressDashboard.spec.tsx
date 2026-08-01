import { render, screen, waitFor } from "@testing-library/react";
import { EquipmentProgressDashboard } from "./EquipmentProgressDashboard";
import { getEquipmentProgressDashboard } from "./equipment-progress-dashboard.api";
import type { EquipmentProgressDashboardDto } from "./equipment-progress-dashboard.types";

vi.mock("./equipment-progress-dashboard.api", () => ({
  getEquipmentProgressDashboard: vi.fn(),
}));

describe("EquipmentProgressDashboard", () => {
  beforeEach(() => {
    vi.mocked(getEquipmentProgressDashboard).mockReset();
  });

  it("renders progress and readable missing fields", async () => {
    vi.mocked(getEquipmentProgressDashboard).mockResolvedValue(
      createDashboardDto({
        averageCreatedPerDay: 1.4,
        completedCardsCount: 8,
        createdCount: 10,
        estimatedCompletionDate: "2026-10-01",
        estimatedDaysRemaining: 79,
        incompleteCardsCount: 2,
        incompleteEquipment: [
          {
            missingFields: ["Серийный номер", "Эксплуатация"],
            name: "Станок",
            visibleId: 7,
          },
        ],
        progressPercent: 8,
        recentCreatedCount: 10,
        recentDailyCounts: [
          { count: 0, date: "2026-07-26" },
          { count: 1, date: "2026-07-27" },
          { count: 2, date: "2026-07-28" },
          { count: 0, date: "2026-07-29" },
          { count: 3, date: "2026-07-30" },
          { count: 2, date: "2026-07-31" },
          { count: 2, date: "2026-08-01" },
        ],
        remainingCount: 110,
        targetCount: 120,
      }),
    );

    render(<EquipmentProgressDashboard />);

    await waitFor(() => {
      expect(
        screen.getByRole("img", { name: "Общий прогресс наполнения 8%" }),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("Создано")).toBeInTheDocument();
    expect(screen.getByText("10 из 120")).toBeInTheDocument();
    expect(screen.getByText("Осталось создать")).toBeInTheDocument();
    expect(screen.getByText("Общий прогресс наполнения")).toBeInTheDocument();
    expect(screen.getByText("Динамика создания за 7 дней")).toBeInTheDocument();
    expect(screen.getByText("Прогноз создания карточек")).toBeInTheDocument();
    expect(screen.getByText("ID 7 — Станок")).toBeInTheDocument();
    expect(
      screen.getByText("Серийный номер, Эксплуатация"),
    ).toBeInTheDocument();
    expect(document.querySelector(".equipment-progress-bar")).toHaveStyle({
      height: "0%",
    });
  });

  it("renders an error state when progress cannot be loaded", async () => {
    vi.mocked(getEquipmentProgressDashboard).mockRejectedValue(
      new Error("Не удалось загрузить дашборд."),
    );

    render(<EquipmentProgressDashboard />);

    expect(
      await screen.findByText("Не удалось загрузить дашборд."),
    ).toBeInTheDocument();
  });

  it("renders zero forecast state when creation pace is empty", async () => {
    vi.mocked(getEquipmentProgressDashboard).mockResolvedValue(
      createDashboardDto({
        averageCreatedPerDay: 0,
        estimatedCompletionDate: null,
        estimatedDaysRemaining: null,
        recentCreatedCount: 0,
        recentDailyCounts: [
          { count: 0, date: "2026-07-26" },
          { count: 0, date: "2026-07-27" },
          { count: 0, date: "2026-07-28" },
          { count: 0, date: "2026-07-29" },
          { count: 0, date: "2026-07-30" },
          { count: 0, date: "2026-07-31" },
          { count: 0, date: "2026-08-01" },
        ],
      }),
    );

    render(<EquipmentProgressDashboard />);

    expect(await screen.findByText("0 в день")).toBeInTheDocument();
    expect(screen.getByText("Недостаточно данных")).toBeInTheDocument();
    expect(
      screen.getByText("Недостаточно данных для прогноза"),
    ).toBeInTheDocument();
  });
});

function createDashboardDto(
  overrides: Partial<EquipmentProgressDashboardDto> = {},
): EquipmentProgressDashboardDto {
  return {
    averageCreatedPerDay: 1.4,
    completedCardsCount: 8,
    createdCount: 10,
    estimatedCompletionDate: "2026-10-01",
    estimatedDaysRemaining: 79,
    incompleteCardsCount: 2,
    incompleteEquipment: [
      {
        missingFields: ["Серийный номер", "Эксплуатация"],
        name: "Станок",
        visibleId: 7,
      },
    ],
    progressPercent: 8,
    recentCreatedCount: 10,
    recentDailyCounts: [
      { count: 0, date: "2026-07-26" },
      { count: 1, date: "2026-07-27" },
      { count: 2, date: "2026-07-28" },
      { count: 0, date: "2026-07-29" },
      { count: 3, date: "2026-07-30" },
      { count: 2, date: "2026-07-31" },
      { count: 2, date: "2026-08-01" },
    ],
    remainingCount: 110,
    targetCount: 120,
    ...overrides,
  };
}
