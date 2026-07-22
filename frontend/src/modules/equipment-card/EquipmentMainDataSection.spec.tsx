import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createEquipmentPhoto } from "./equipment-card.test-helpers";
import { EquipmentMainDataSection } from "./EquipmentMainDataSection";

describe("EquipmentMainDataSection", () => {
  it("renders section title, photo gallery and fields", () => {
    render(
      <EquipmentMainDataSection
        fields={[{ label: "Производитель", value: "DMG MORI" }]}
        photos={[createEquipmentPhoto()]}
        title="Основные данные"
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Основные данные" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Открыть фото оборудования" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Производитель")).toBeInTheDocument();
  });
});
