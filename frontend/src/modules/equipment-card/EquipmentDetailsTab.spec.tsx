import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  createEquipmentCard,
  createEquipmentPhoto,
} from "./equipment-card.test-helpers";
import { EquipmentDetailsTab } from "./EquipmentDetailsTab";

describe("EquipmentDetailsTab", () => {
  it("renders details panel with the expected accessibility attributes", () => {
    render(
      <EquipmentDetailsTab
        equipment={createEquipmentCard()}
        isPhotosLoading={false}
        photos={[createEquipmentPhoto()]}
        photosError={null}
      />,
    );

    const panel = screen.getByRole("tabpanel");

    expect(panel).toHaveAttribute("id", "equipment-panel-details");
    expect(panel).toHaveAttribute(
      "aria-labelledby",
      "equipment-tab-details",
    );
    expect(screen.getByText("Описание")).toBeInTheDocument();
    expect(screen.getByText("Технические характеристики")).toBeInTheDocument();
  });
});
