import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEquipmentCard, createEquipmentHistoryItem } from "./equipment-card.test-helpers";
import { EquipmentCardView } from "./EquipmentCardView";

const mockUseEquipmentPhotos = vi.fn();
const mockNavigateWithViewTransition = vi.fn();
const mockDocumentsPanel = vi.fn();
const mockEventsPanel = vi.fn();
const mockMaintenancePanel = vi.fn();

vi.mock("../equipment-documents", () => ({
  EquipmentDocumentsPanel: (props: unknown) => {
    mockDocumentsPanel(props);
    return <div>Документы панели</div>;
  },
}));

vi.mock("../equipment-events", () => ({
  EquipmentEventsPanel: (props: unknown) => {
    mockEventsPanel(props);
    return <div>События панели</div>;
  },
}));

vi.mock("../equipment-maintenance-settings", () => ({
  MaintenanceSettingsPanel: (props: unknown) => {
    mockMaintenancePanel(props);
    return <div>Настройки обслуживания панели</div>;
  },
}));

vi.mock("./use-equipment-photos", () => ({
  useEquipmentPhotos: (params: unknown) => mockUseEquipmentPhotos(params),
}));

vi.mock("./equipment-card-navigation", () => ({
  navigateWithViewTransition: (href: string) => mockNavigateWithViewTransition(href),
}));

describe("EquipmentCardView", () => {
  beforeEach(() => {
    mockUseEquipmentPhotos.mockReset();
    mockUseEquipmentPhotos.mockReturnValue({
      error: null,
      isLoading: false,
      photos: [],
    });
    mockNavigateWithViewTransition.mockReset();
    mockDocumentsPanel.mockReset();
    mockEventsPanel.mockReset();
    mockMaintenancePanel.mockReset();
    window.location.hash = "#/equipment/42";
  });

  it("renders title and opens details tab by default", () => {
    render(
      <EquipmentCardView
        equipment={createEquipmentCard()}
        history={[createEquipmentHistoryItem()]}
        returnTo="#/equipment"
      />,
    );

    expect(screen.getByRole("heading", { name: "ID 42 — Токарный станок" })).toBeInTheDocument();
    expect(screen.getByRole("tabpanel")).toHaveAttribute(
      "id",
      "equipment-panel-details",
    );
    expect(mockUseEquipmentPhotos).toHaveBeenCalledWith({
      enabled: true,
      visibleId: 42,
    });
  });

  it("renders documents tab from initialTab and reacts to prop changes", () => {
    const { rerender } = render(
      <EquipmentCardView
        equipment={createEquipmentCard()}
        history={[]}
        initialTab="documents"
        returnTo="#/equipment?filter=active"
      />,
    );

    expect(screen.getByText("Документы панели")).toBeInTheDocument();

    rerender(
      <EquipmentCardView
        equipment={createEquipmentCard()}
        history={[]}
        initialTab="history"
        returnTo="#/equipment?filter=active"
      />,
    );

    expect(screen.getByRole("tabpanel")).toHaveAttribute(
      "id",
      "equipment-panel-history",
    );
  });

  it("shows edit button only on details and documents tabs", async () => {
    const user = userEvent.setup();

    render(
      <EquipmentCardView
        canEdit
        equipment={createEquipmentCard()}
        history={[]}
        returnTo="#/equipment?filter=active"
      />,
    );

    expect(
      screen.getByRole("link", { name: /Редактировать/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Документы" }));
    expect(
      screen.getByRole("link", { name: /Редактировать/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "События" }));
    expect(
      screen.queryByRole("link", { name: /Редактировать/i }),
    ).not.toBeInTheDocument();
  });

  it("builds edit link with tab and returnTo params and calls navigateWithViewTransition", async () => {
    const user = userEvent.setup();

    render(
      <EquipmentCardView
        canEdit
        equipment={createEquipmentCard()}
        history={[]}
        returnTo="#/equipment?filter=active"
      />,
    );

    await user.click(screen.getByRole("tab", { name: "Документы" }));

    const editLink = screen.getByRole("link", { name: /Редактировать/i });
    expect(editLink).toHaveAttribute(
      "href",
      "#/equipment/42/edit?returnTo=%23%2Fequipment%3Ffilter%3Dactive&tab=documents",
    );

    await user.click(editLink);

    expect(mockNavigateWithViewTransition).toHaveBeenCalledWith(
      "#/equipment/42/edit?returnTo=%23%2Fequipment%3Ffilter%3Dactive&tab=documents",
    );
  });

  it("switches tabs, updates hash and calls external onTabChange", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();

    render(
      <EquipmentCardView
        equipment={createEquipmentCard()}
        history={[]}
        onTabChange={onTabChange}
        returnTo="#/equipment"
      />,
    );

    await user.click(screen.getByRole("tab", { name: "История изменений" }));

    expect(onTabChange).toHaveBeenCalledWith("history");
    expect(window.location.hash).toBe("#/equipment/42?returnTo=%23%2Fequipment&tab=history");
    expect(screen.getByRole("tabpanel")).toHaveAttribute(
      "id",
      "equipment-panel-history",
    );
  });

  it("does not re-emit updates when the active tab is selected again", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();

    render(
      <EquipmentCardView
        equipment={createEquipmentCard()}
        history={[]}
        onTabChange={onTabChange}
        returnTo="#/equipment"
      />,
    );

    const currentHash = window.location.hash;
    await user.click(screen.getByRole("tab", { name: "Карточка" }));

    expect(onTabChange).not.toHaveBeenCalled();
    expect(window.location.hash).toBe(currentHash);
  });

  it("passes feature permissions to nested panels", async () => {
    const user = userEvent.setup();

    render(
      <EquipmentCardView
        canManageEquipmentEvents
        canManageMaintenanceSettings
        equipment={createEquipmentCard()}
        history={[]}
        returnTo="#/equipment"
      />,
    );

    await user.click(screen.getByRole("tab", { name: "События" }));
    expect(mockEventsPanel).toHaveBeenLastCalledWith(
      expect.objectContaining({
        canManageEvents: true,
        equipmentStatus: "ACTIVE",
        visibleId: 42,
      }),
    );

    await user.click(
      screen.getByRole("tab", { name: "Настройки обслуживания" }),
    );
    expect(mockMaintenancePanel).toHaveBeenLastCalledWith(
      expect.objectContaining({
        canManage: true,
        visibleId: 42,
      }),
    );
  });

  it("disables photo loading outside of the details tab", async () => {
    const user = userEvent.setup();

    render(
      <EquipmentCardView
        equipment={createEquipmentCard()}
        history={[]}
        returnTo="#/equipment"
      />,
    );

    expect(mockUseEquipmentPhotos).toHaveBeenLastCalledWith({
      enabled: true,
      visibleId: 42,
    });

    await user.click(screen.getByRole("tab", { name: "Документы" }));

    expect(mockUseEquipmentPhotos).toHaveBeenLastCalledWith({
      enabled: false,
      visibleId: 42,
    });
  });
});
