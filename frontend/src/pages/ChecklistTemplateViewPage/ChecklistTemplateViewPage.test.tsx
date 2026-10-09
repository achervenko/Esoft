import { cleanup, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import * as api from "../../shared/api/checklists";
import { ChecklistTemplateViewPage } from "./ChecklistTemplateViewPage";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState(null, "");
});

it("keeps the initial saved message but clears it when another template opens", async () => {
  window.history.replaceState({ checklistTemplateSaved: true, otherState: "keep" }, "");
  vi.spyOn(api, "getChecklistTemplate").mockImplementation(async (id) => ({
    template: {
      id, name: `Шаблон ${id}`, state: "ACTIVE", modules: [],
      archivedAt: null, basedOnTemplateId: null, createdAt: "2026-01-01",
      description: null, publishedAt: null, updatedAt: "2026-01-01", version: 1,
    },
    usage: { maintenanceSettings: [], maintenanceSettingsCount: 0 },
  }));
  const view = render(<StrictMode><ChecklistTemplateViewPage templateId={1} userRole="admin" /></StrictMode>);
  await screen.findByRole("heading", { name: "Шаблон 1" });
  expect(screen.getByText("Шаблон сохранён.")).toBeInTheDocument();
  expect(window.history.state).toEqual({ checklistTemplateSaved: false, otherState: "keep" });
  view.rerender(<StrictMode><ChecklistTemplateViewPage templateId={2} userRole="admin" /></StrictMode>);
  await screen.findByRole("heading", { name: "Шаблон 2" });
  expect(screen.queryByText("Шаблон сохранён.")).not.toBeInTheDocument();
});
