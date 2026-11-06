import { useState } from "react";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { ReceiptPlacementStepper } from "./ReceiptPlacementStepper";
import { receipt, permissions } from "./receipts-test-context";
import type { Receipt } from "../../shared/api/warehouse-receipts-api";
vi.mock("./ReceiptPlaceForm", () => ({
  ReceiptPlaceForm: ({
    onSavingChange,
    onSaved,
  }: {
    onSavingChange: (value: boolean) => void;
    onSaved: () => void;
  }) => (
    <button
      onClick={() => {
        onSavingChange(true);
        onSaved();
      }}
    >
      Тест размещения
    </button>
  ),
}));
afterEach(() => {
  cleanup();
  sessionStorage.clear();
});
export const twoLines: Receipt = {
  ...receipt,
  lines: [receipt.lines[0], { ...receipt.lines[0], id: "3", name: "Кабель" }],
};
export function Controlled({
  value = twoLines,
  onMap = vi.fn(),
  onExit = vi.fn(),
}: {
  value?: Receipt;
  onMap?: () => void;
  onExit?: () => void;
}) {
  const [position, setPosition] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  return (
    <ReceiptPlacementStepper
      receipt={value}
      actorId="actor"
      permissions={permissions}
      position={position}
      onPositionChange={setPosition}
      saving={saving}
      onSavingChange={setSaving}
      onSaved={() => {}}
      onMap={onMap}
      onExit={onExit}
    />
  );
}

export { receipt } from "./receipts-test-context";
