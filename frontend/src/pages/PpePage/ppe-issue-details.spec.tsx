import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ppeApi } from "../../shared/api/ppe";
import { render } from "./ppe-ui-test-utils";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
import { IssueDetailsModal } from "./IssueDetailsModal";
import { issue } from "./ppe-test-fixtures";

describe("PPE issue details", () => {
  it("renders snapshots and cancellation metadata, never substitutes current catalogue names", async () => {
    vi.spyOn(ppeApi, "issueDetails").mockResolvedValue({
      ...issue,
      status: "CANCELLED",
      cancellationReason: "Ошибка выбора",
      cancelledAt: "2026-10-06T10:00:00Z",
      cancelledByName: "Отменивший сотрудник",
    });
    render(
      <IssueDetailsModal
        id={8}
        role="admin"
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    );
    await screen.findByRole("heading", { name: /Историческое имя сотрудника/ });
    expect(screen.getByText("Историческая должность")).toBeInTheDocument();
    expect(screen.getByText("ACT-01 / Выданный костюм")).toBeInTheDocument();
    expect(screen.getByText("88–92 / 170–176")).toBeInTheDocument();
    expect(screen.getByText("Отменивший сотрудник")).toBeInTheDocument();
    expect(screen.getByText("Ошибка выбора")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Отменить выдачу" }),
    ).not.toBeInTheDocument();
  });
  it("requires a reason to cancel and reloads snapshots and dependent data after success", async () => {
    vi.spyOn(ppeApi, "issueDetails").mockResolvedValue(issue);
    vi.spyOn(ppeApi, "cancel").mockResolvedValue({
      ...issue,
      status: "CANCELLED",
    });
    const onChanged = vi.fn();
    render(
      <IssueDetailsModal
        id={8}
        role="admin"
        onClose={vi.fn()}
        onChanged={onChanged}
      />,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Отменить выдачу" }),
    );
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("button", { name: "Подтвердить отмену" }),
    ).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Причина"), {
      target: { value: " Ошибка " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Подтвердить отмену" }));
    await waitFor(() =>
      expect(ppeApi.cancel).toHaveBeenCalledWith(8, "Ошибка"),
    );
    expect(onChanged).toHaveBeenCalledOnce();
    await waitFor(() => expect(ppeApi.issueDetails).toHaveBeenCalledTimes(2));
  });
});
