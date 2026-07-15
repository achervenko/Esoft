import {
  File as FileIcon,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  type LucideIcon,
} from "lucide-react";
import type { EquipmentFile } from "../../shared/api/equipment-files/equipment-files.types";
import { getFilePreviewUrl } from "../../shared/api/files-api";
import { AsyncImage } from "../../shared/ui/AsyncImage";
import { getFileExtension } from "./equipment-document-utils";

type EquipmentDocumentIconProps = {
  file: EquipmentFile;
};

export function EquipmentDocumentIcon({ file }: EquipmentDocumentIconProps) {
  if (file.documentType === "equipment_photo") {
    return (
      <div
        className="equipment-document-icon equipment-document-icon-thumbnail"
        title="Фото"
      >
        <AsyncImage src={getFilePreviewUrl(file.id, { size: "small" })} />
      </div>
    );
  }

  const iconInfo = getFileIconInfo(file);
  const Icon = iconInfo.Icon;

  return (
    <div
      className={`equipment-document-icon equipment-document-icon-${iconInfo.variant}`}
      title={iconInfo.label}
    >
      <Icon aria-hidden="true" size={20} />
    </div>
  );
}

function getFileIconInfo(file: EquipmentFile): {
  Icon: LucideIcon;
  label: string;
  variant: "archive" | "document" | "image" | "pdf" | "sheet" | "unknown";
} {
  const extension = getFileExtension(file);

  if (extension === "pdf") {
    return { Icon: FileText, label: "PDF", variant: "pdf" };
  }

  if (
    ["jpg", "jpeg", "png", "gif", "webp", "bmp", "tiff", "svg"].includes(
      extension,
    )
  ) {
    return {
      Icon: FileImage,
      label: extension.toUpperCase(),
      variant: "image",
    };
  }

  if (["xls", "xlsx", "csv", "ods"].includes(extension)) {
    return {
      Icon: FileSpreadsheet,
      label: extension.toUpperCase(),
      variant: "sheet",
    };
  }

  if (["zip", "rar", "7z", "tar", "gz"].includes(extension)) {
    return {
      Icon: FileArchive,
      label: extension.toUpperCase(),
      variant: "archive",
    };
  }

  if (["doc", "docx", "txt", "rtf", "odt"].includes(extension)) {
    return {
      Icon: FileText,
      label: extension.toUpperCase(),
      variant: "document",
    };
  }

  return {
    Icon: FileIcon,
    label: extension ? extension.toUpperCase() : "FILE",
    variant: "unknown",
  };
}
