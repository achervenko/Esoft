import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createEquipmentCard } from "./equipment-card.test-helpers";
import {
  getEquipmentCardSections,
  getEquipmentCardTextBlocks,
} from "./equipment-card-view-model";

describe("equipment-card-view-model", () => {
  it('builds sections and shows "б/н" for empty serial number', () => {
    const equipment = createEquipmentCard({
      manufactureYear: null,
      serialNumber: null,
    });

    const sections = getEquipmentCardSections(equipment);

    expect(sections).toHaveLength(3);
    expect(sections[0]?.title).toBe("Основные данные");
    expect(sections[1]?.title).toBe("Местонахождение");
    expect(sections[2]?.title).toBe("Учетные данные");

    const serialField = sections[0]?.fields.find(
      (field) => field.label === "Заводской номер",
    );

    expect(serialField?.value).toBe("б/н");
  });

  it("renders equipment status badge in sections", () => {
    const equipment = createEquipmentCard();
    const sections = getEquipmentCardSections(equipment);
    const statusField = sections[0]?.fields.find(
      (field) => field.label === "Статус",
    );

    render(<>{statusField?.value}</>);

    expect(screen.getByText("В работе")).toBeInTheDocument();
  });

  it("returns text blocks in the expected order", () => {
    const equipment = createEquipmentCard();

    expect(getEquipmentCardTextBlocks(equipment)).toEqual([
      {
        label: "Технические характеристики",
        value: "Мощность 5 кВт",
      },
      {
        label: "Технологическая операция",
        value: "Токарная обработка",
      },
      {
        label: "Примечание",
        value: "Примечание",
      },
    ]);
  });
});
