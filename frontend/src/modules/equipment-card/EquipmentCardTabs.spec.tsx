import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EquipmentCardTabs } from "./EquipmentCardTabs";

describe("EquipmentCardTabs", () => {
  it("renders all equipment tabs", () => {
    render(
      <EquipmentCardTabs activeTab="details" onTabChange={vi.fn()} />,
    );

    expect(screen.getByRole("tab", { name: "Карточка" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Документы" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "События" })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Настройки обслуживания" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "История изменений" }),
    ).toBeInTheDocument();
  });

  it("marks only the active tab as selected and focusable", () => {
    render(
      <EquipmentCardTabs activeTab="events" onTabChange={vi.fn()} />,
    );

    const activeTab = screen.getByRole("tab", { name: "События" });
    const inactiveTab = screen.getByRole("tab", { name: "Документы" });

    expect(activeTab).toHaveAttribute("aria-selected", "true");
    expect(activeTab).toHaveAttribute("tabindex", "0");
    expect(inactiveTab).toHaveAttribute("aria-selected", "false");
    expect(inactiveTab).toHaveAttribute("tabindex", "-1");
  });

  it("links tabs with their tab panels", () => {
    render(
      <EquipmentCardTabs activeTab="maintenance-settings" onTabChange={vi.fn()} />,
    );

    const tab = screen.getByRole("tab", { name: "Настройки обслуживания" });

    expect(tab).toHaveAttribute("id", "equipment-tab-maintenance-settings");
    expect(tab).toHaveAttribute(
      "aria-controls",
      "equipment-panel-maintenance-settings",
    );
  });

  it("calls onTabChange when a tab is clicked", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();

    render(<EquipmentCardTabs activeTab="details" onTabChange={onTabChange} />);

    await user.click(screen.getByRole("tab", { name: "Документы" }));

    expect(onTabChange).toHaveBeenCalledWith("documents");
  });

  it("supports keyboard navigation between tabs", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();

    render(<EquipmentCardTabs activeTab="details" onTabChange={onTabChange} />);

    const detailsTab = screen.getByRole("tab", { name: "Карточка" });
    detailsTab.focus();

    await user.keyboard("{ArrowRight}");
    expect(onTabChange).toHaveBeenLastCalledWith("documents");
    expect(screen.getByRole("tab", { name: "Документы" })).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(onTabChange).toHaveBeenLastCalledWith("events");
    expect(screen.getByRole("tab", { name: "События" })).toHaveFocus();
  });

  it("supports reverse and boundary keyboard navigation", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    const { rerender } = render(
      <EquipmentCardTabs activeTab="history" onTabChange={onTabChange} />,
    );

    const historyTab = screen.getByRole("tab", { name: "История изменений" });
    historyTab.focus();

    await user.keyboard("{ArrowRight}");
    expect(onTabChange).toHaveBeenLastCalledWith("details");

    rerender(<EquipmentCardTabs activeTab="details" onTabChange={onTabChange} />);
    const detailsTab = screen.getByRole("tab", { name: "Карточка" });
    detailsTab.focus();

    await user.keyboard("{ArrowLeft}");
    expect(onTabChange).toHaveBeenLastCalledWith("history");

    await user.keyboard("{Home}");
    expect(onTabChange).toHaveBeenLastCalledWith("details");

    await user.keyboard("{End}");
    expect(onTabChange).toHaveBeenLastCalledWith("history");
  });
});
