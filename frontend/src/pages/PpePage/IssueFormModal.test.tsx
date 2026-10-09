import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ppeApi } from "../../shared/api/ppe";
import { ApiRequestError } from "../../shared/api/api-error";
import { IssueFormModal } from "./IssueFormModal";
import {
  employee,
  item,
  recommendation,
  planRow,
  issue,
} from "./ppe-test-fixtures";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
beforeEach(() => {
  vi.spyOn(ppeApi, "recommendSize").mockResolvedValue(recommendation);
  vi.spyOn(ppeApi, "issue").mockResolvedValue([{ ...issue, warnings: [] }]);
});
const open = (rows = [planRow], issuedAt?: string) => {
  const onCreated = vi.fn();
  const onClose = vi.fn();
  render(
    <IssueFormModal
      employee={employee}
      items={[
        item,
        { ...item, id: 10, article: "B", name: "Замена", sizes: [] },
      ]}
      regularRows={rows}
      issuedAt={issuedAt}
      onCreated={onCreated}
      onClose={onClose}
    />,
  );
  return { onCreated, onClose };
};
describe("PPE issue form", () => {
  it("uses the backend default BODY pair, lets the user choose another and sends only regular fields", async () => {
    open();
    await waitFor(() =>
      expect(
        screen.getByLabelText("Фактический размер / ростовка"),
      ).toHaveValue("4"),
    );
    expect(screen.queryByLabelText("Количество")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /96-100/ }),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Фактический размер / ростовка"), {
      target: { value: "5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Подтвердить выдачу" }));
    await waitFor(() =>
      expect(ppeApi.issue).toHaveBeenCalledWith(true, {
        employeeId: 1,
        items: [{ normItemId: 7, ppeItemId: 3, sizeId: 5 }],
      }),
    );
  });
  it("submits a whole regular batch in one request, with the admin date", async () => {
    open([planRow, { ...planRow, normItemId: 11 }], "2026-01-02");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Выдать выбранное (2)" }),
      ).toBeEnabled(),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Выдать выбранное (2)" }),
    );
    await waitFor(() => expect(ppeApi.issue).toHaveBeenCalledTimes(1));
    expect(vi.mocked(ppeApi.issue).mock.calls[0][1]).toEqual({
      employeeId: 1,
      issuedAt: "2026-01-02",
      items: [
        { ppeItemId: 3, normItemId: 7, sizeId: 4 },
        { ppeItemId: 3, normItemId: 11, sizeId: 4 },
      ],
    });
  });
  it("fetches a new backend recommendation for the actual replacement and clears the previous size", async () => {
    vi.mocked(ppeApi.recommendSize).mockImplementation(
      async (_employeeId, id) =>
        id === 3
          ? recommendation
          : {
              ...recommendation,
              type: "OTHER",
              recommendedSizeId: null,
              recommendedSizeValue: null,
              recommendedHeightValue: null,
              activeSizes: [],
            },
    );
    open();
    await screen.findByLabelText("Фактический размер / ростовка");
    fireEvent.change(screen.getByLabelText("Выдаём фактически"), {
      target: { value: "10" },
    });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Подтвердить выдачу" }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Подтвердить выдачу" }));
    await waitFor(() =>
      expect(ppeApi.issue).toHaveBeenCalledWith(true, {
        employeeId: 1,
        items: [{ normItemId: 7, ppeItemId: 10 }],
      }),
    );
    expect(ppeApi.recommendSize).toHaveBeenCalledWith(
      1,
      10,
      expect.any(AbortSignal),
    );
  });
  it("does not auto-select a size when there is no match", async () => {
    vi.mocked(ppeApi.recommendSize).mockResolvedValue({
      ...recommendation,
      recommendedSizeId: null,
      requiresSelection: true,
    });
    open();
    const select = await screen.findByLabelText(
      "Фактический размер / ростовка",
    );
    expect(select).toHaveValue("");
    expect(
      screen.getByRole("button", { name: "Подтвердить выдачу" }),
    ).toBeDisabled();
    fireEvent.change(select, { target: { value: "5" } });
    expect(
      screen.getByRole("button", { name: "Подтвердить выдачу" }),
    ).toBeEnabled();
  });
  it("blocks the item with only inactive sizes", async () => {
    vi.mocked(ppeApi.recommendSize).mockResolvedValue({
      ...recommendation,
      recommendedSizeId: null,
      activeSizes: [],
      requiresSelection: true,
    });
    open();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Все размеры удалены",
    );
    expect(
      screen.getByRole("button", { name: "Подтвердить выдачу" }),
    ).toBeDisabled();
    expect(ppeApi.issue).not.toHaveBeenCalled();
  });
  it("keeps the batch form open on an atomic failure without reporting partial success", async () => {
    vi.mocked(ppeApi.issue).mockRejectedValue(
      new ApiRequestError("Conflict", 409, "PPE_NORM_ALREADY_ISSUED"),
    );
    const callbacks = open();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Подтвердить выдачу" }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Подтвердить выдачу" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("уже выдана");
    expect(callbacks.onClose).not.toHaveBeenCalled();
    expect(callbacks.onCreated).not.toHaveBeenCalled();
  });
  it("sends EXTRA quantity without a norm reference", async () => {
    render(
      <IssueFormModal
        employee={employee}
        items={[item]}
        regularRows={null}
        onCreated={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(
      screen.queryByText(
        "Дополнительная выдача не засчитывается как нормативная.",
      ),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Выдаём фактически"), {
      target: { value: "3" },
    });
    fireEvent.change(screen.getByLabelText("Количество"), {
      target: { value: "2.5" },
    });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Подтвердить выдачу" }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Подтвердить выдачу" }));
    await waitFor(() =>
      expect(ppeApi.issue).toHaveBeenCalledWith(false, {
        employeeId: 1,
        items: [{ ppeItemId: 3, sizeId: 4, quantity: 2.5 }],
      }),
    );
  });
});

it("does not treat an automatic size recommendation as an unsaved user edit", async () => {
  const { onClose } = open();
  await waitFor(() =>
    expect(
      screen.getByLabelText("Фактический размер / ростовка"),
    ).toBeInTheDocument(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
  expect(onClose).toHaveBeenCalledOnce();
  expect(
    screen.queryByText("Есть несохраненные изменения"),
  ).not.toBeInTheDocument();
});
it("keeps a manually entered issuance comment when the user stays", async () => {
  const { onClose } = open();
  await waitFor(() =>
    expect(
      screen.getByLabelText("Фактический размер / ростовка"),
    ).toBeInTheDocument(),
  );
  fireEvent.change(screen.getByLabelText("Комментарий"), {
    target: { value: "Черновик выдачи" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Остаться" }));
  expect(screen.getByLabelText("Комментарий")).toHaveValue("Черновик выдачи");
});
