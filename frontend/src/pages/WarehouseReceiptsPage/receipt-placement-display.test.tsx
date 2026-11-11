import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Controlled, receipt } from "./receipt-placement-test-utils";

it("shows the source order on the placement line without presenting it as a stock reservation", () => {
  render(
    <Controlled
      value={{
        ...receipt,
        lines: [
          {
            ...receipt.lines[0],
            order: {
              id: "external-order",
              number: "DEMO50K-P-001",
              name: "Монтаж участка",
            },
          },
        ],
      }}
    />,
  );
  expect(screen.getByText("DEMO50K-P-001")).toBeVisible();
  expect(screen.getByText(/Заказ 1С:/)).toHaveTextContent(
    "Заказ 1С: DEMO50K-P-001 · Монтаж участка",
  );
  expect(screen.queryByText(/Зарезервировано/)).not.toBeInTheDocument();
});

it("omits the source order when the receipt line has none", () => {
  render(
    <Controlled
      value={{ ...receipt, lines: [{ ...receipt.lines[0], order: null }] }}
    />,
  );
  expect(screen.queryByText(/Заказ 1С:/)).not.toBeInTheDocument();
});

it.each([null, "ESOFT-123"])(
  "keeps the canonical article separate from the source article (%s)",
  (article) => {
    render(
      <Controlled
        value={{
          ...receipt,
          lines: [
            {
              ...receipt.lines[0],
              article,
              sourceArticle: "ONE-C-456",
              itemId: article ? receipt.lines[0].itemId : null,
            },
          ],
        }}
      />,
    );
    if (article) expect(screen.getByText(article)).toBeInTheDocument();
    expect(screen.queryByText(/Артикул:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/ONE-C-456/)).not.toBeInTheDocument();
  },
);

it("shows every saved location immediately and removes the placement button when complete", () => {
  render(
    <Controlled
      value={{
        ...receipt,
        lines: [
          {
            ...receipt.lines[0],
            placed: "10",
            remaining: "0",
            placements: [
              {
                id: "p1",
                storageLocationId: "501",
                quantity: "5.125",
                location: { name: "А-01" },
                createdAt: receipt.createdAt,
              },
              {
                id: "p2",
                storageLocationId: "502",
                quantity: "4.875",
                location: { name: "В-04" },
                createdAt: receipt.createdAt,
              },
            ],
          },
        ],
      }}
    />,
  );
  expect(
    screen.getByRole("list", { name: "Сохранённые размещения" }),
  ).toBeInTheDocument();
  expect(screen.getByText("А-01")).toBeVisible();
  expect(screen.getByText("В-04")).toBeVisible();
  expect(screen.getByText("5,125")).toBeVisible();
  expect(screen.getByText("4,875")).toBeVisible();
  expect(
    screen.queryByText("Всё количество размещено"),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Разместить" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText(/Размещено по местам:/)).not.toBeInTheDocument();
});

it("keeps saved locations visible while the remainder is being placed", () => {
  render(
    <Controlled
      value={{
        ...receipt,
        lines: [
          {
            ...receipt.lines[0],
            placements: [
              {
                id: "p1",
                storageLocationId: "501",
                quantity: "4",
                location: { name: "А-01" },
                createdAt: receipt.createdAt,
              },
            ],
          },
        ],
      }}
    />,
  );
  expect(screen.getByText("А-01")).toBeVisible();
  expect(screen.getByRole("button", { name: "Тест размещения" })).toBeEnabled();
  expect(
    screen.queryByText("Всё количество размещено"),
  ).not.toBeInTheDocument();
});
