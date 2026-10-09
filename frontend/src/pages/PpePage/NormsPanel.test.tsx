import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ppeApi } from "../../shared/api/ppe";
import { NormsPanel } from "./NormsPanel";
import { norm, item } from "./ppe-test-fixtures";
import { businessToday } from "../../modules/ppe-ui/ppe-presentation";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("offers end only for current norms, delete only for future norms, and no historical actions", async () => {
  vi.spyOn(ppeApi, "norms").mockResolvedValue([
    { ...norm, id: 10, effectiveFrom: businessToday(), effectiveTo: null },
    { ...norm, id: 11, effectiveFrom: "2999-01-01", effectiveTo: null },
    { ...norm, id: 12, effectiveFrom: "2000-01-01", effectiveTo: "2001-01-01" },
  ]);
  const end = vi.spyOn(ppeApi, "endNorm").mockResolvedValue(norm);
  const changed = vi.fn();
  render(
    <ChakraProvider value={defaultSystem}>
      <NormsPanel
        positions={[
          { id: norm.positionId, name: norm.position, isActive: true },
        ]}
        items={[item]}
        role="admin"
        revision={0}
        initialPositionId={norm.positionId}
        onChanged={changed}
      />
    </ChakraProvider>,
  );
  const button = await screen.findByRole("button", {
    name: "Завершить действие",
  });
  expect(screen.getAllByRole("button", { name: "Удалить" })).toHaveLength(1);
  expect(
    screen.getAllByRole("button", { name: "Создать новую редакцию" }),
  ).toHaveLength(1);
  const futureCard = screen.getByText("Будущая").closest("section")!;
  expect(
    within(futureCard).getByRole("button", { name: "Редактировать" }),
  ).toBeInTheDocument();
  expect(
    within(futureCard).getByRole("button", { name: "Создать новую редакцию" }),
  ).toBeInTheDocument();

  expect(
    within(screen.getByText("Завершённая").closest("section")!).queryByRole(
      "button",
    ),
  ).not.toBeInTheDocument();
  fireEvent.click(button);
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "Завершить действие",
    }),
  );
  await vi.waitFor(() => expect(changed).toHaveBeenCalledOnce());
  expect(end).toHaveBeenCalledWith(10, businessToday());
});

it("edits a future revision and starts its successor after the source date", async () => {
  vi.spyOn(ppeApi, "norms").mockResolvedValue([
    { ...norm, effectiveFrom: "2999-01-01" },
  ]);
  const save = vi.spyOn(ppeApi, "saveNorm").mockResolvedValue(norm);
  render(
    <ChakraProvider value={defaultSystem}>
      <NormsPanel
        positions={[
          { id: norm.positionId, name: norm.position, isActive: true },
        ]}
        items={[item]}
        role="admin"
        revision={0}
        initialPositionId={norm.positionId}
        onChanged={vi.fn()}
      />
    </ChakraProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Редактировать" }));
  fireEvent.change(screen.getByLabelText("Дата начала"), {
    target: { value: "2999-02-01" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Сохранить норму" }));
  await vi.waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      "edit",
      norm.id,
      norm.positionId,
      expect.objectContaining({ effectiveFrom: "2999-02-01" }),
    ),
  );
  await vi.waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Создать новую редакцию" }),
  );
  expect(screen.getByLabelText("Дата начала")).toHaveValue("2999-01-02");
});
it("warns about extending the predecessor before deleting a future norm", async () => {
  vi.spyOn(ppeApi, "norms").mockResolvedValue([
    {
      ...norm,
      id: 10,
      effectiveFrom: businessToday(),
      effectiveTo: "2998-12-31",
    },
    { ...norm, id: 11, effectiveFrom: "2999-01-01", effectiveTo: null },
  ]);
  const remove = vi.spyOn(ppeApi, "deleteNorm").mockResolvedValue({ id: 11 });
  const changed = vi.fn();
  render(
    <ChakraProvider value={defaultSystem}>
      <NormsPanel
        positions={[
          { id: norm.positionId, name: norm.position, isActive: true },
        ]}
        items={[item]}
        role="admin"
        revision={0}
        initialPositionId={norm.positionId}
        onChanged={changed}
      />
    </ChakraProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Удалить" }));
  expect(
    screen.getByText(/Текущая норма будет продлена без даты окончания/),
  ).toBeInTheDocument();
  expect(remove).not.toHaveBeenCalled();
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: "Удалить" }),
  );
  await vi.waitFor(() => expect(changed).toHaveBeenCalledOnce());
  expect(remove).toHaveBeenCalledWith(11);
});
it("lists positions with and without norms and opens the selected position", async () => {
  vi.spyOn(ppeApi, "norms").mockResolvedValue([
    { ...norm, effectiveFrom: "2000-01-01", effectiveTo: null },
  ]);
  render(
    <ChakraProvider value={defaultSystem}>
      <NormsPanel
        positions={[
          { id: norm.positionId, name: norm.position, isActive: true },
          { id: 99, name: "Без нормы", isActive: true },
        ]}
        items={[item]}
        role="admin"
        revision={0}
        onChanged={vi.fn()}
      />
    </ChakraProvider>,
  );
  const position = await screen.findByText(norm.position);
  expect(
    within(position.closest("tr")!).getByText("Действующая"),
  ).toBeInTheDocument();
  const empty = screen.getByText("Без нормы").closest("tr")!;
  expect(within(empty).getByText("Отсутствует")).toBeInTheDocument();
  fireEvent.click(within(empty).getByRole("button", { name: "Создать норму" }));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(ppeApi.norms).toHaveBeenCalledWith(undefined, expect.any(AbortSignal));
});
