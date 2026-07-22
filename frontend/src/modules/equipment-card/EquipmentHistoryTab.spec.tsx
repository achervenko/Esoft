import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createEquipmentHistoryItem } from "./equipment-card.test-helpers";
import { EquipmentHistoryTab } from "./EquipmentHistoryTab";

describe("EquipmentHistoryTab", () => {
  it("renders loading state inside the history tab panel", () => {
    render(
      <EquipmentHistoryTab error={null} history={[]} isLoading />,
    );

    const panel = screen.getByRole("tabpanel");

    expect(panel).toHaveAttribute("id", "equipment-panel-history");
    expect(panel).toHaveAttribute(
      "aria-labelledby",
      "equipment-tab-history",
    );
    expect(screen.getByText("Загрузка истории...")).toBeInTheDocument();
  });

  it("renders history entries when loading succeeds", () => {
    render(
      <EquipmentHistoryTab
        error={null}
        history={[createEquipmentHistoryItem()]}
        isLoading={false}
      />,
    );

    expect(screen.getByText("История изменений")).toBeInTheDocument();
    expect(screen.getByText("Изменение")).toBeInTheDocument();
  });
});
