import type { EquipmentFile } from "../../shared/api/equipment-files/equipment-files.types";

export function formatFileCount(count: number) {
  return `${count} ${getFileWord(count)}`;
}

export function getDisplayName(file: EquipmentFile) {
  return file.displayName.replace(/\*/g, "_");
}

export function getFileExtension(file: EquipmentFile) {
  const sourceName =
    getDisplayName(file) || decodeMojibakeText(file.originalName);
  const extension = sourceName.match(/\.([a-z0-9]{1,12})$/i)?.[1];

  return extension?.toLowerCase() ?? "";
}

export function isPdfFile(file: EquipmentFile) {
  return (
    file.mimeType.toLowerCase() === "application/pdf" ||
    getFileExtension(file) === "pdf"
  );
}

function getFileWord(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return "\u0444\u0430\u0439\u043b";
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return "\u0444\u0430\u0439\u043b\u0430";
  }

  return "\u0444\u0430\u0439\u043b\u043e\u0432";
}

function decodeMojibakeText(value: string) {
  if (!/[\u00d0\u00d1\u00c2]/.test(value)) {
    return value;
  }

  const bytes = Uint8Array.from([...value], (char) => char.charCodeAt(0));
  const decodedValue = new TextDecoder("utf-8", { fatal: false }).decode(bytes);

  if (
    decodedValue.includes("\ufffd") ||
    !/[\u0400-\u04ff]/.test(decodedValue)
  ) {
    return value;
  }

  return decodedValue;
}
