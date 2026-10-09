import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MyChecklistViewPage } from "./MyChecklistViewPage";
const work = vi.hoisted(() => ({ hasUnsavedChanges: true, isActionLoading: false }));
vi.mock("./hooks/use-checklist-work", () => ({ useChecklistWork: () => work }));
vi.mock("./components/MyChecklistDetail", () => ({ MyChecklistDetail: () => <div>Черновик</div> }));
vi.mock("../../shared/ui/useConfirmation", () => ({ useConfirmation: () => vi.fn() }));
beforeEach(() => {
  window.history.replaceState(null, "", "#/my-checklists/1");
  work.hasUnsavedChanges = true;
  work.isActionLoading = false;
});
afterEach(cleanup);

it("asks before leaving a dirty checklist and preserves it on cancel", () => {
  render(<MyChecklistViewPage checklistId={1} fallbackTab="in-progress" />);
  fireEvent.click(screen.getByRole("link", { name: "Назад" }));
  expect(screen.getByText("Есть несохраненные изменения")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Остаться" }));
  expect(window.location.hash).toBe("#/my-checklists/1");
  expect(screen.getByText("Черновик")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("link", { name: "Назад" }));
  fireEvent.click(screen.getByRole("button", { name: "Выйти" }));
  expect(window.location.hash).toBe("#/my-checklists?tab=in-progress");
});

it("protects a dirty checklist from browser reload", () => {
  render(<MyChecklistViewPage checklistId={1} fallbackTab="in-progress" />);
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
});

it("blocks leaving while saving even when the draft is clean", () => {
  work.hasUnsavedChanges = false;
  work.isActionLoading = true;
  render(<MyChecklistViewPage checklistId={1} fallbackTab="in-progress" />);
  const link = screen.getByRole("link", { name: "Назад" });
  expect(fireEvent.click(link)).toBe(false);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
