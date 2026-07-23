import { equipmentDocumentsText as text } from "./equipment-documents.text";

export function notifyUploadValidationWarning(
  validationError: string,
  notifyWarning: (title: string, message?: string) => string,
) {
  if (validationError === text.errors.fileTooLarge) {
    notifyWarning("Размер файла превышает допустимый", validationError);
    return;
  }

  if (
    validationError === text.errors.unsupportedFileFormat ||
    validationError === text.errors.passportPdfOnly ||
    validationError === text.errors.instructionPdfOnly ||
    validationError === text.errors.photoImagesOnly
  ) {
    notifyWarning("Формат файла не поддерживается", validationError);
    return;
  }

  notifyWarning("Заполните обязательные поля", validationError);
}
