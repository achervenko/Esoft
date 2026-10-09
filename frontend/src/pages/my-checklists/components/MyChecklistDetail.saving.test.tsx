import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ChecklistWorkDetail } from "../../../shared/api/checklists";
import type { MyChecklistDetailProps } from "../my-checklists.types";
import { MyChecklistDetail } from "./MyChecklistDetail";
import { ConfirmationProvider } from "../../../shared/ui/ConfirmationProvider";
vi.mock("./ChecklistSummary", () => ({ ChecklistSummary: () => null }));
vi.mock("./ChecklistModules", () => ({ ChecklistModules: ({ canEdit }: { canEdit: boolean }) =>
  <input aria-label="Ответ" disabled={!canEdit} /> }));
afterEach(cleanup);

function createProps(): MyChecklistDetailProps {
  const checklist = {
    status: "IN_PROGRESS", assignedUser: { fullName: "Сотрудник" },
    template: { name: "Проверка" }, event: { maintenanceType: { name: "ТО" } }, modules: [],
  } as unknown as ChecklistWorkDetail;
  return {
    checklist, canMutateSelected: true, draftAnswers: {}, draftResult: null,
    formError: null, isActionLoading: true, isDetailLoading: false, resultError: null,
    showRequiredErrors: false, versionConflict: null,
    onAnswerChange: vi.fn(), onComplete: vi.fn(), onReload: vi.fn(), onResultChange: vi.fn(), onSave: vi.fn(),
  };
}

it("locks answers and result during saving, then restores editing", () => {
  const props = createProps();
  const view = render(<MyChecklistDetail {...props} />);
  expect(screen.getByLabelText("Ответ")).toBeDisabled();
  expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Сохранить" })).toBeDisabled();
  view.rerender(<MyChecklistDetail {...props} isActionLoading={false} />);
  expect(screen.getByLabelText("Ответ")).toBeEnabled();
  expect(screen.getAllByRole("radio")).toHaveLength(3);
});

it("completes only after accepting the shared confirmation", async () => {
  const props = { ...createProps(), isActionLoading: false };
  render(<ConfirmationProvider><MyChecklistDetail {...props} /></ConfirmationProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Завершить чек-лист" }));
  expect(props.onComplete).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Назад" }));
  await act(async () => {});
  expect(props.onComplete).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Завершить чек-лист" }));
  fireEvent.click(screen.getByRole("button", { name: "Завершить" }));
  await waitFor(() => expect(props.onComplete).toHaveBeenCalledOnce());
});

it("does not complete after cancelling confirmation through navigation", async () => {
  const props = { ...createProps(), isActionLoading: false };
  render(<ConfirmationProvider><MyChecklistDetail {...props} /></ConfirmationProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Завершить чек-лист" }));
  await act(async () => { window.dispatchEvent(new HashChangeEvent("hashchange")); });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(props.onComplete).not.toHaveBeenCalled();
});
