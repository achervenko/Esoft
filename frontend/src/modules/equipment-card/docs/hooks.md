# Хуки

## useEquipmentPhotos

Файл:

- `use-equipment-photos.ts`

Назначение:

- загрузить и отфильтровать фотографии оборудования для вкладки `details`

Сигнатура:

```ts
useEquipmentPhotos({
  enabled: boolean,
  visibleId: number,
})
```

Возвращает:

- `photos: EquipmentFile[]`
- `isLoading: boolean`
- `error: string | null`

## Внутренняя логика

Хук хранит:

- полный список файлов `files`
- `filesVisibleId`
- `filesVisibleIdRef`
- `error`
- `isLoading`

Алгоритм работы:

1. Если `enabled === false`, запрос не выполняется.
2. Если вкладка активна, хук очищает ошибку.
3. Вызывает `getEquipmentFiles(visibleId)`.
4. При успехе сохраняет все файлы и привязывает их к текущему `visibleId`.
5. При ошибке очищает старые файлы, если ошибка относится к новому `visibleId`.
6. На выходе отдаёт только файлы с `documentType === "equipment_photo"`.

## Особенности

- хук не использует `AbortController`
- защита от устаревшего обновления состояния реализована через локальный `isMounted`
- фильтрация выполняется через `useMemo`
- кеш между закрытием и повторным открытием вкладки не сохраняется

## Сценарии использования

Текущий модуль использует хук только в:

- `EquipmentCardView`

Параметр `enabled` там зависит от активной вкладки:

- `activeTab === "details"`
