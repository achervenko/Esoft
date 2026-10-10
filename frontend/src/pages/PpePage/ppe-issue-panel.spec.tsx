import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ppeApi } from "../../shared/api/ppe";
import { render } from "./ppe-ui-test-utils";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
import { IssuePanel } from "./IssuePanel";
import { PpePage } from "./PpePage";
import { businessToday } from "../../modules/ppe-ui/ppe-presentation";
import { employee, item, planRow, issue, plan } from "./ppe-test-fixtures";

describe("PPE plan and permissions", () => {
  it("does not fetch PPE for an unauthorized role", () => {
    vi.spyOn(ppeApi, "items");
    render(<PpePage userRole="operator" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Недостаточно прав");
    expect(ppeApi.items).not.toHaveBeenCalled();
  });
  it("lets specialists search and view the plan without issuance controls", async () => {
    vi.spyOn(ppeApi, "plan").mockResolvedValue(plan);
    vi.spyOn(ppeApi, "recommendSize").mockResolvedValue(planRow.sizes);
    vi.spyOn(ppeApi, "issue").mockResolvedValue([
      {
        ...issue,
        warnings: [
          {
            code: "PPE_SIZE_DIFFERS_FROM_RECOMMENDED",
            message:
              "Выбранный размер отличается от рекомендуемого размера сотрудника.",
          },
        ],
      },
    ]);
    const onChanged = vi.fn();
    render(
      <IssuePanel
        initialEmployeeId={1}
        employees={[employee]}
        items={[item]}
        role="ppe_specialist"
        revision={0}
        onChanged={onChanged}
      />,
    );
    expect(
      screen.queryByLabelText("Дата плана и выдачи"),
    ).not.toBeInTheDocument();
    await screen.findByText("Просрочено");
    expect(ppeApi.plan).toHaveBeenCalledWith(
      1,
      undefined,
      expect.any(AbortSignal),
    );
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Подтвердить" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Дополнительная выдача" }),
    ).not.toBeInTheDocument();
    expect(ppeApi.issue).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
  });
  it("uses the selected admin date for the plan and POST", async () => {
    vi.spyOn(ppeApi, "plan").mockResolvedValue(plan);
    vi.spyOn(ppeApi, "recommendSize").mockResolvedValue(planRow.sizes);
    vi.spyOn(ppeApi, "issue").mockResolvedValue([{ ...issue, warnings: [] }]);
    render(
      <IssuePanel
        initialEmployeeId={1}
        employees={[employee]}
        items={[item]}
        role="admin"
        revision={0}
        onChanged={vi.fn()}
      />,
    );
    expect(
      screen.queryByLabelText("Дата плана и выдачи"),
    ).not.toBeInTheDocument();
    await screen.findByText("Просрочено");
    expect(ppeApi.plan).toHaveBeenCalledWith(
      1,
      businessToday(),
      expect.any(AbortSignal),
    );
    fireEvent.change(screen.getByLabelText("Дата выдачи"), {
      target: { value: "2026-01-15" },
    });
    await waitFor(() =>
      expect(ppeApi.plan).toHaveBeenLastCalledWith(
        1,
        "2026-01-15",
        expect.any(AbortSignal),
      ),
    );
    await screen.findByText("Просрочено");
    fireEvent.click(screen.getByRole("checkbox", { name: /Выбрать/ }).closest("label")!);
    fireEvent.click(await screen.findByRole("button", { name: "Подтвердить" }));
    await waitFor(() =>
      expect(
        within(screen.getByRole("dialog")).getByRole("button", { name: "Подтвердить" }),
      ).toBeEnabled(),
    );
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Подтвердить" }));
    await waitFor(() =>
      expect(ppeApi.issue).toHaveBeenCalledWith(
        true,
        expect.objectContaining({ issuedAt: "2026-01-15" }),
      ),
    );
  });
  it("allows EXTRA without a norm but blocks new issuance for an inactive employee", async () => {
    vi.spyOn(ppeApi, "plan").mockResolvedValue({
      ...plan,
      norm: null,
      items: [],
    });
    const view = render(
      <IssuePanel
        initialEmployeeId={1}
        employees={[employee]}
        items={[item]}
        role="admin"
        revision={0}
        onChanged={vi.fn()}
      />,
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    await screen.findByText(/На эту дату для должности нет действующей нормы/);
    expect(
      screen.getByRole("button", { name: "Дополнительная выдача" }),
    ).toBeEnabled();
    view.rerender(
      <IssuePanel
        initialEmployeeId={1}
        employees={[{ ...employee, isActive: false }]}
        items={[item]}
        role="admin"
        revision={0}
        onChanged={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Дополнительная выдача" }),
    ).not.toBeInTheDocument();
  });
});
