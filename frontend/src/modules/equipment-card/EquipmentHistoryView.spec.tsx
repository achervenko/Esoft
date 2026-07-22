import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createEquipmentHistoryItem } from "./equipment-card.test-helpers";
import { EquipmentHistoryView } from "./EquipmentHistoryView";

describe("EquipmentHistoryView", () => {
  it("renders empty state when history is empty", () => {
    render(<EquipmentHistoryView history={[]} />);

    expect(screen.getByText("По этой карточке пока нет записей.")).toBeInTheDocument();
  });

  it("groups close update events from the same user", () => {
    render(
      <EquipmentHistoryView
        history={[
          createEquipmentHistoryItem({
            createdAt: "2026-07-22T09:30:00.000Z",
            fieldName: "Статус",
            id: 1,
            newValue: "В работе",
            oldValue: "Резерв",
          }),
          createEquipmentHistoryItem({
            createdAt: "2026-07-22T09:30:10.000Z",
            fieldName: "Ответственный",
            id: 2,
            newValue: "Петров Петр",
            oldValue: "Иванов Иван",
          }),
        ]}
      />,
    );

    expect(screen.getByText("2 поля")).toBeInTheDocument();
    expect(screen.getByText("Статус")).toBeInTheDocument();
    expect(screen.getByText("Ответственный")).toBeInTheDocument();
  });

  it("shows every file item inside a grouped file action", () => {
    render(
      <EquipmentHistoryView
        history={[
          createEquipmentHistoryItem({
            action: "FILE_UPLOAD",
            createdAt: "2026-07-22T09:30:00.000Z",
            fieldName: null,
            id: 1,
            newValue: "Фото 1.jpg",
            oldValue: null,
          }),
          createEquipmentHistoryItem({
            action: "FILE_UPLOAD",
            createdAt: "2026-07-22T09:30:10.000Z",
            fieldName: null,
            id: 2,
            newValue: "Фото 2.jpg",
            oldValue: null,
          }),
        ]}
      />,
    );

    expect(screen.getByText("Документ загружен")).toBeInTheDocument();
    expect(screen.getByText("Фото 1.jpg")).toBeInTheDocument();
    expect(screen.getByText("Фото 2.jpg")).toBeInTheDocument();
  });

  it("formats missing values and dates in Russian text", () => {
    render(
      <EquipmentHistoryView
        history={[
          createEquipmentHistoryItem({
            createdAt: "invalid-date",
            fieldName: "  ",
            id: 1,
            newValue: "не указано",
            oldValue: null,
          }),
        ]}
      />,
    );

    expect(screen.getAllByText("Не указано").length).toBeGreaterThan(0);
    expect(screen.getByText("Дата не указана")).toBeInTheDocument();
  });
});
