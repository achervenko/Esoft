import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import * as filesApi from "../../shared/api/equipment-files/equipment-files.api";
import { NotificationProvider } from "../../shared/ui/notifications";
import { EquipmentDocumentUploadForm } from "./EquipmentDocumentUploadForm";
import type { EquipmentFile } from "../../shared/api/equipment-files/equipment-files.types";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("uploads dropped files, keeps the failed file and retries it alone", async () => {
  const first = new File(["first"], "first.pdf", { type: "application/pdf" });
  const second = new File(["other"], first.name, {
    lastModified: first.lastModified,
    type: "application/pdf",
  });
  const asUploaded = (file: File, id: number): EquipmentFile => ({
    id,
    createdAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    displayName: file.name,
    documentType: "maintenance_instruction",
    isPrimary: false,
    mimeType: file.type,
    originalName: file.name,
    sizeBytes: String(file.size),
  });
  const upload = vi
    .spyOn(filesApi, "uploadEquipmentFile")
    .mockResolvedValueOnce(asUploaded(first, 1))
    .mockRejectedValueOnce(new TypeError("network"))
    .mockResolvedValueOnce(asUploaded(second, 2));
  const onUploaded = vi.fn();
  const onClose = vi.fn();
  render(
    <NotificationProvider>
      <EquipmentDocumentUploadForm
        documentType="maintenance_instruction"
        existingFiles={[]}
        onClose={onClose}
        onUploaded={onUploaded}
        title="Инструкция"
        visibleId={1}
      />
    </NotificationProvider>,
  );
  fireEvent.drop(
    screen.getByRole("group", { name: "Область загрузки файлов" }),
    {
      dataTransfer: { files: [first, second] },
    },
  );
  await waitFor(() => expect(screen.getAllByText(first.name)).toHaveLength(2));
  fireEvent.drop(
    screen.getByRole("group", { name: "Область загрузки файлов" }),
    {
      dataTransfer: {
        files: [
          new File([first], first.name, {
            type: first.type,
            lastModified: first.lastModified,
          }),
        ],
      },
    },
  );
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Загрузить" })).toBeEnabled(),
  );
  const rows = screen.getAllByText(first.name);
  expect(rows).toHaveLength(2);
  const secondRow = rows[1].closest("li");
  fireEvent.click(screen.getByRole("button", { name: "Загрузить" }));
  expect(await screen.findByText("Нет соединения с сервером.")).toBeVisible();
  expect(screen.getAllByText(first.name)).toHaveLength(1);
  expect(screen.getByText(second.name).closest("li")).toBe(secondRow);
  expect(onUploaded).toHaveBeenCalledWith([asUploaded(first, 1)], false);
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Повторить загрузку" }));
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  expect(upload.mock.calls.map(([request]) => request.file)).toEqual([
    first,
    second,
    second,
  ]);
  const [firstKey, secondKey, retryKey] = upload.mock.calls.map(
    ([request]) => request.requestKey,
  );
  expect(firstKey).not.toBe(secondKey);
  expect(retryKey).toBe(secondKey);
  expect(onUploaded).toHaveBeenLastCalledWith([asUploaded(second, 2)], true);
});
