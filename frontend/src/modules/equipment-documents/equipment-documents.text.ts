import type { StorageDocumentType } from "../../shared/api/equipment-files/equipment-files.types";

export const equipmentDocumentsText = {
  chooseFile: "Выбрать файл",
  delete: "Удалить",
  deleteConfirmPrefix: "Удалить документ «",
  deleteConfirmSuffix: "» из карточки оборудования?",
  deleted: "Документ удалён из карточки.",
  deleting: "Удаление...",
  documentsTitle: "Документы оборудования",
  download: "Скачать",
  downloading: "Скачивание...",
  makePrimary: "Сделать основным",
  makingPrimary: "Назначение...",
  emptyEdit:
    "Загрузите паспорт, инструкцию, фото или другие документы.",
  emptyView:
    "Для этого оборудования ещё нет загруженных документов.",
  errors: {
    database:
      "Файл загружен, но не удалось сохранить сведения о документе.",
    passportAlreadyExists:
      "Паспорт для этого оборудования уже загружен. Удалите его перед загрузкой нового.",
    documentTypeRequired: "Выберите тип документа.",
    emptyFile: "Файл пустой или не передан.",
    equipmentNotFound: "Оборудование не найдено.",
    fileRequired: "Выберите файл для загрузки.",
    fileTooLarge: "Размер файла не должен превышать 25 МБ.",
    forbidden: "Недостаточно прав для загрузки документов.",
    instructionPdfOnly:
      "Для инструкции по обслуживанию доступен только формат PDF.",
    invalidImage:
      "Изображение повреждено или имеет неверный формат.",
    invalidPdf:
      "Файл PDF повреждён или имеет неверный формат.",
    network: "Нет соединения с сервером.",
    passportPdfOnly: "Для паспорта доступен только формат PDF.",
    photoImagesOnly: "Для фотографии доступны JPG, PNG и WebP.",
    serverUnavailable: "Сервер временно недоступен.",
    sessionExpired:
      "Сессия завершена. Войдите в систему повторно.",
    storageUnavailable: "Хранилище файлов временно недоступно.",
    timeout: "Время ожидания загрузки истекло.",
    unreadableFile:
      "Имя файла пустое или файл не удаётся прочитать.",
    unsupportedDocumentType: "Некорректный тип документа.",
    unsupportedFileFormat:
      "Выбран неподдерживаемый формат.",
    uploadFailed:
      "Не удалось завершить загрузку. Изменения отменены.",
    uploadInProgress:
      "Файл уже загружается. Дождитесь завершения.",
  },
  file: "Файл",
  fileNotSelected: "Файл не выбран",
  loading: "Загрузка документов...",
  noFiles: "Файлы пока не загружены.",
  savedChanges: "Изменения сохранены.",
  primaryPhotoSaved: "Основное фото обновлено.",
  saveChanges: "Сохранить изменения",
  saving: "Сохранение...",
  selectDocumentType: "Выберите тип документа",
  success: {
    instruction: "Инструкция по обслуживанию успешно загружена.",
    passport: "Паспорт успешно загружен.",
    photo: "Фотография оборудования добавлена.",
    supportingDocument: "Другой документ успешно сохранён.",
  },
  type: "Тип документа",
  upload: "Загрузить документ",
  uploading: "Загрузка...",
  uploadTitle: "Загрузка документов",
} as const;

export const documentTypeOptions: Array<{
  label: string;
  value: StorageDocumentType;
}> = [
  { label: "Паспорт", value: "passport" },
  {
    label: "Инструкция по обслуживанию",
    value: "maintenance_instruction",
  },
  {
    label: "Фото оборудования",
    value: "equipment_photo",
  },
  {
    label: "Другие документы",
    value: "supporting_document",
  },
];
