import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { WarehouseProductSummary } from "./WarehouseProductSummary";
import { WarehouseLocationSummary } from "./WarehouseLocationSummary";
import { WarehouseItemPhoto } from "./WarehouseItemPhoto";

afterEach(cleanup);
const item = {
  name: "Подшипник 6205",
  article: "6205-2RS",
  unit: "шт",
  photo: null,
};

describe("shared warehouse summaries", () => {
  it("shows the same item card with the quantity meaning supplied by its caller", () => {
    const { rerender } = render(
      <WarehouseProductSummary
        item={item}
        quantity="12.125"
        quantityLabel="Общий остаток"
      />,
    );
    expect(screen.getByText(item.name)).toBeInTheDocument();
    expect(screen.getByText(item.article)).toBeInTheDocument();
    expect(screen.getByText("Общий остаток")).toBeInTheDocument();
    expect(screen.getByText("12,125 шт")).toBeInTheDocument();
    rerender(
      <WarehouseProductSummary
        item={item}
        quantity="4.001"
        quantityLabel="Резерв"
      />,
    );
    expect(screen.queryByText("Общий остаток")).not.toBeInTheDocument();
    expect(screen.getByText("Резерв")).toBeInTheDocument();
    expect(screen.getByText("4,001 шт")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
  it("retains long location names and exact decimal quantities without editable actions", () => {
    const name =
      "Очень длинное место хранения материалов в дальнем углу склада";
    render(
      <WarehouseLocationSummary
        name={name}
        quantity="9007199254.123"
        unit="м"
      />,
    );
    expect(screen.getByText(name)).toHaveAttribute("title", name);
    expect(screen.getByText("9007199254,123 м")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
  it("preserves zero quantities and missing photo presentation", () => {
    render(
      <WarehouseProductSummary
        item={item}
        quantity="0"
        quantityLabel="Резерв"
      />,
    );
    expect(screen.getByText("0 шт")).toBeInTheDocument();
    expect(screen.getByLabelText("Нет фотографии")).toBeInTheDocument();
  });
  it("uses the existing image component with the item name as alternative text", () => {
    render(<WarehouseItemPhoto item={{ ...item, photo: "/item-photo.png" }} />);
    expect(screen.getByRole("img", { name: item.name })).toHaveAttribute(
      "src",
      "/item-photo.png",
    );
  });
});
