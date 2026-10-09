import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { TemplateStructureContextMenu } from "./TemplateStructureContextMenu";
afterEach(cleanup);
it("retains module actions through the shared menu", () => {
  const add = vi.fn(),
    close = vi.fn();
  render(
    <TemplateStructureContextMenu
      menu={{ x: 20, y: 30, target: { kind: "module", moduleId: 1 } }}
      onAddQuestions={add}
      onDelete={vi.fn()}
      onClose={close}
    />,
  );
  expect(
    screen.getByRole("menuitem", { name: "Удалить модуль" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("menuitem", { name: "Добавить вопросы" }));
  expect(add).toHaveBeenCalledOnce();
  expect(close).toHaveBeenCalledOnce();
});
it("only offers question deletion for a question", () => {
  render(
    <TemplateStructureContextMenu
      menu={{
        x: 20,
        y: 30,
        target: { kind: "question", moduleId: 1, questionId: 2 },
      }}
      onAddQuestions={vi.fn()}
      onDelete={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  expect(screen.getAllByRole("menuitem")).toHaveLength(1);
  expect(
    screen.getByRole("menuitem", { name: "Удалить вопрос" }),
  ).toBeInTheDocument();
});
