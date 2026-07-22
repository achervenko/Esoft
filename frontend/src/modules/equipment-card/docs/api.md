# API

## Общая граница модуля

Модуль карточки оборудования не делает запрос на получение самой карточки оборудования.

Он получает снаружи:

- `EquipmentCard`
- `EquipmentHistoryItem[]`

Собственный прямой API-запрос внутри модуля используется только для фотографий.

## getEquipmentFiles

Файл:

- `shared/api/equipment-files/equipment-files.api.ts`

Сигнатура:

```ts
getEquipmentFiles(visibleId: number): Promise<EquipmentFile[]>
```

Назначение:

- получить список файлов оборудования по `visibleId`

Маршрут:

- `GET /api/equipment/:visibleId/files`

Параметры:

- `visibleId` — пользовательский номер оборудования

Формат ответа:

- массив `EquipmentFile[]`

Во frontend карточки используются в первую очередь поля:

- `id`
- `displayName`
- `documentType`
- `isPrimary`
- `mimeType`
- `originalName`
- `createdAt`
- `sizeBytes`

Обработка ошибок:

- ошибка преобразуется через `getApiErrorMessage()`
- хук `useEquipmentPhotos` сохраняет её в `error`
- `EquipmentPhotoGallery` показывает текст ошибки вместо фотографии

## getFilePreviewUrl

Файл:

- `shared/api/files-api.ts`

Сигнатура:

```ts
getFilePreviewUrl(fileId: number, options?: { size?: "small" | "medium" }): string
```

Назначение:

- построить URL preview изображения

Использование:

- `EquipmentPhotoGallery` использует `size: "medium"` для карточки;
- `ImagePreviewModal` использует полный preview без параметра `size`.

## Внешние API модуля

Хотя `equipment-card` сам их не вызывает, он зависит от результатов следующих API:

- API карточки оборудования, которое возвращает `EquipmentCard`
- API истории изменений, которое возвращает `EquipmentHistoryItem[]`

Эти запросы выполняются страницей или другим внешним контейнером, а не самим модулем карточки.
