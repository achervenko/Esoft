import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EquipmentTextBlock } from "./EquipmentTextBlock";

describe("EquipmentTextBlock", () => {
  it("renders the provided text value", () => {
    render(
      <EquipmentTextBlock
        label="Технические характеристики"
        value="Мощность 5 кВт"
      />,
    );

    expect(screen.getByRole("heading", { name: "Технические характеристики" })).toBeInTheDocument();
    expect(screen.getByText("Мощность 5 кВт")).toBeInTheDocument();
  });

  it('renders fallback for an empty value', () => {
    render(<EquipmentTextBlock label="Примечание" value={null} />);

    expect(screen.getByText("Не указано")).toBeInTheDocument();
  });
});
