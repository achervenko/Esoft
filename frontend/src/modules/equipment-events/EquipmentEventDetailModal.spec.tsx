import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EquipmentEventDetailModal } from "./EquipmentEventDetailModal";

describe("EquipmentEventDetailModal", () => {
  it("shows detail loading error instead of endless loading", () => {
    render(
      <EquipmentEventDetailModal
        error="Не удалось загрузить событие."
        event={null}
        isLoading={false}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByText("Загрузка события...")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Не удалось загрузить событие.",
    );
  });
});
