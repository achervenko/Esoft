import { permissionsForTest } from "../../test/permission-fixtures";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { StrictMode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import * as api from "../../shared/api/checklists";
import { ChecklistTemplateViewPage } from "./ChecklistTemplateViewPage";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState(null, "");
});

it("keeps the initial saved message but clears it and closes deletion when another template opens", async () => {
  window.history.replaceState({ checklistTemplateSaved: true, otherState: "keep" }, "");
  vi.spyOn(api, "getChecklistTemplate").mockImplementation(async (id) => ({
    template: {
      id, name: `Шаблон ${id}`, state: "ACTIVE", modules: [],
      archivedAt: null, basedOnTemplateId: null, createdAt: "2026-01-01",
      description: null, publishedAt: null, updatedAt: "2026-01-01", version: 1,
    },
    usage: { maintenanceSettings: [], maintenanceSettingsCount: 0 },
  }));
  const page = (id: number, permissions = permissionsForTest("admin")) => (
    <StrictMode>
      <ChakraProvider value={defaultSystem}>
        <ChecklistTemplateViewPage templateId={id} userPermissions={permissions} />
      </ChakraProvider>
    </StrictMode>
  );
  const view = render(page(1));
  await screen.findByRole("heading", { name: "Шаблон 1" });
  expect(screen.getByText("Шаблон сохранён.")).toBeInTheDocument();
  expect(window.history.state).toEqual({ checklistTemplateSaved: false, otherState: "keep" });
  fireEvent.click(screen.getByRole("button", { name: "Удалить" }));
  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  view.rerender(page(2));
  await screen.findByRole("heading", { name: "Шаблон 2" });
  expect(screen.queryByText("Шаблон сохранён.")).not.toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Удалить" }));
  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  view.rerender(page(2, []));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  view.rerender(page(2));
  await screen.findByRole("heading", { name: "Шаблон 2" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
