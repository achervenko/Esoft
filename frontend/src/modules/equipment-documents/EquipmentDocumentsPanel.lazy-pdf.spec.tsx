import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { EquipmentFile } from "../../shared/api/equipment-files/equipment-files.types";
import { EquipmentDocumentsPanel } from "./EquipmentDocumentsPanel";

const testState = vi.hoisted(() => ({
  pdfPreviewImportCount: 0,
  previewFile: null as EquipmentFile | null,
}));

vi.mock("./EquipmentDocumentTypeSection", () => ({
  EquipmentDocumentTypeSection: () => (
    <div data-testid="equipment-document-type-section" />
  ),
}));

vi.mock("./useEquipmentDocumentsPanel", () => ({
  useEquipmentDocumentsPanel: () => ({
    deletingFileId: null,
    downloadingFileId: null,
    error: null,
    files: [],
    filesByDocumentType: {
      equipment_photo: [],
      maintenance_instruction: [],
      passport: [],
      supporting_document: [],
    },
    handleDelete: () => undefined,
    handleDownload: () => undefined,
    handleFileChange: () => undefined,
    handleSaveChanges: () => undefined,
    handleSetPrimary: () => undefined,
    hasUnsavedDocumentChanges: false,
    isLoading: false,
    previewFile: testState.previewFile,
    selectedFiles: {},
    setPreviewFile: () => undefined,
    settingPrimaryFileId: null,
    uploadingDocumentType: null,
  }),
}));

vi.mock("../../shared/ui/pdf-preview/PdfPreviewModal", () => {
  testState.pdfPreviewImportCount += 1;

  return {
    PdfPreviewModal: ({ fileName }: { fileName: string }) => (
      <div>{fileName}</div>
    ),
  };
});

function createPdfFile(): EquipmentFile {
  return {
    createdAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    displayName: "manual.pdf",
    documentType: "maintenance_instruction",
    id: 10,
    isPrimary: false,
    mimeType: "application/pdf",
    originalName: "manual.pdf",
    sizeBytes: "1024",
  };
}

describe("EquipmentDocumentsPanel PDF preview lazy loading", () => {
  afterEach(() => {
    testState.pdfPreviewImportCount = 0;
    testState.previewFile = null;
  });

  it("imports PDF preview code only after preview is opened", async () => {
    const { rerender } = render(
      <EquipmentDocumentsPanel mode="view" visibleId={1} />,
    );

    expect(testState.pdfPreviewImportCount).toBe(0);

    testState.previewFile = createPdfFile();

    rerender(<EquipmentDocumentsPanel mode="view" visibleId={1} />);

    expect(await screen.findByText("manual.pdf")).toBeInTheDocument();
    expect(testState.pdfPreviewImportCount).toBe(1);
  });
});
