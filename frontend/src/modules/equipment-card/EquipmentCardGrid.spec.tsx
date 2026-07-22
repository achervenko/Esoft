import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EquipmentCardGrid } from "./EquipmentCardGrid";

describe("EquipmentCardGrid", () => {
  it("renders labels and values in a description list", () => {
    render(
      <EquipmentCardGrid
        items={[
          { label: "Производитель", value: "DMG MORI" },
          { label: "Модель", value: "CTX 310" },
        ]}
      />,
    );

    expect(screen.getByText("Производитель")).toBeInTheDocument();
    expect(screen.getByText("DMG MORI")).toBeInTheDocument();
    expect(screen.getByText("Модель")).toBeInTheDocument();
    expect(screen.getByText("CTX 310")).toBeInTheDocument();
  });
});
