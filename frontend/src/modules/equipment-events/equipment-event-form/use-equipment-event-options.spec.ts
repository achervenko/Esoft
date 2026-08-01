import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { EquipmentEventItem } from "../equipment-events.types";
import { useEquipmentEventOptions } from "./use-equipment-event-options";

describe("useEquipmentEventOptions", () => {
  it("keeps already assigned responsibles when they are missing from users contract", () => {
    const event = {
      checklists: [],
      maintenanceType: {
        code: "TO-1",
        id: 1,
        name: "TO-1",
      },
      responsibles: [
        {
          fullName: "Inactive Responsible",
          id: "inactive-user",
        },
      ],
    } as unknown as EquipmentEventItem;

    const { result } = renderHook(() =>
      useEquipmentEventOptions({
        event,
        maintenanceSettings: [],
        maintenanceTypeId: "1",
        mode: "edit",
        users: [
          {
            id: "active-user",
            name: "Active Responsible",
            position: "Engineer",
          },
        ],
      }),
    );

    expect(result.current.responsibleOptions).toEqual([
      {
        id: "inactive-user",
        isUnavailable: true,
        name: "Inactive Responsible",
        position: "Ранее назначен, сейчас недоступен",
      },
      {
        id: "active-user",
        name: "Active Responsible",
        position: "Engineer",
      },
    ]);
    expect(result.current.unavailableResponsibleIds.has("inactive-user"))
      .toBe(true);
  });
});
