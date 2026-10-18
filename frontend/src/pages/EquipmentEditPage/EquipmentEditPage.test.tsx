import { initialEquipmentCreateFormState } from "../../modules/equipment-create-form/model/equipment-create-form.types";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EquipmentEditPage } from "./EquipmentEditPage";
import { useEquipmentEditPage } from "./useEquipmentEditPage";
import { EquipmentDocumentsPanel } from "../../modules/equipment-documents";

vi.mock("./useEquipmentEditPage", () => ({ useEquipmentEditPage: vi.fn() }));
vi.mock("../../modules/equipment-documents", () => ({
  EquipmentDocumentsPanel: vi.fn(({ mode }: { mode: string }) => <div data-testid="documents">{mode}</div>),
}));
vi.mock("../../shared/ui/UnsavedChangesGuard", () => ({ UnsavedChangesGuard: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useEquipmentEditPage).mockReturnValue({
    isEditAllowed: true, activeTab: "documents", setActiveTab: vi.fn(),
    isLoading: false,
    options: { countries: [], employees: [], manufacturers: [], models: [], nextVisibleId: 12, sections: [], statuses: [] },
    initialForm: initialEquipmentCreateFormState, form: initialEquipmentCreateFormState,
    error: null, fieldErrors: {}, handleFieldFocus: vi.fn(), handleSubmit: vi.fn(),
    hasUnsavedChanges: false, isSubmitting: false, updateForm: vi.fn(),
    handleDocumentsSaved: vi.fn(),
  });
});
afterEach(cleanup);

it.each([
  [[], null],
  [["files.manage"], null],
  [["files.read"], "view"],
  [["files.read", "files.manage"], "edit"],
] as const)("checks document read permission separately for %p", (permissions, mode) => {
  render(<EquipmentEditPage initialTab="documents" returnTo="#/equipment" visibleId={12}
    userPermissions={["equipment.edit", ...permissions]} />);
  if (mode === null) {
    expect(screen.getByText("Нет доступа к документам оборудования.")).toBeInTheDocument();
    expect(EquipmentDocumentsPanel).not.toHaveBeenCalled();
  } else {
    expect(screen.getByTestId("documents")).toHaveTextContent(mode);
    expect(vi.mocked(EquipmentDocumentsPanel).mock.calls[0][0]).toMatchObject({ mode, visibleId: 12 });
  }
});

it("unmounts documents when files.read is removed", () => {
  const props = { initialTab: "documents" as const, returnTo: "#/equipment", visibleId: 12 };
  const { rerender } = render(<EquipmentEditPage {...props} userPermissions={["equipment.edit", "files.read"]} />);
  expect(screen.getByTestId("documents")).toBeInTheDocument();
  rerender(<EquipmentEditPage {...props} userPermissions={["equipment.edit"]} />);
  expect(screen.queryByTestId("documents")).not.toBeInTheDocument();
  expect(screen.getByText("Нет доступа к документам оборудования.")).toBeInTheDocument();
});
