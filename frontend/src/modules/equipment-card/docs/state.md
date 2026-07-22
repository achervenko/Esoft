# Состояние

## EquipmentCardView

Локальный state:

- `activeTab`

Производные значения:

- `editHref`
- `enabled` для `useEquipmentPhotos`

Эффекты:

- `useEffect` синхронизирует `activeTab` с `initialTab`

Причины повторного рендера:

- смена `activeTab`
- смена props карточки
- новое состояние `useEquipmentPhotos`
- изменение `initialTab`

## EquipmentPhotoGallery

Локальный state:

- `activeIndex`
- `isPreviewOpen`

Производные значения:

- `sortedPhotos`
- `activePhoto`
- `photoSetKey`
- `canNavigate`

Эффекты:

- при изменении `photoSetKey` галерея сбрасывает активный индекс и закрывает preview

Причины повторного рендера:

- новый список фотографий
- переключение активной фотографии
- открытие или закрытие preview

## ImagePreviewModal

Локальные ref:

- `dialogRef`

Локальный state:

- отсутствует

Эффекты:

- сохраняет предыдущий фокус
- блокирует `body` scroll
- переводит фокус внутрь диалога
- восстанавливает фокус и `overflow` при размонтировании

## useEquipmentPhotos

Локальный state:

- `files`
- `filesVisibleId`
- `error`
- `isLoading`

Ref:

- `filesVisibleIdRef`

Производные значения:

- `photos`

Эффекты:

- при `enabled && visibleId` запускает загрузку файлов

Причины повторного рендера:

- начало загрузки
- успешное завершение запроса
- ошибка запроса
- смена `enabled`
- смена `visibleId`
