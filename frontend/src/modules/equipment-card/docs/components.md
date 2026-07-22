# Компоненты

## EquipmentCardView

Назначение:

- корневой контейнер карточки оборудования.

Ответственность:

- показать заголовок карточки;
- хранить активную вкладку;
- синхронизировать вкладку с hash;
- показывать кнопку перехода в редактирование;
- подключать нужную панель по активной вкладке;
- подключать фотографии только для `details`.

Props:

- `equipment: EquipmentCard`
- `history: EquipmentHistoryItem[]`
- `returnTo: string`
- `initialTab?: EquipmentViewTab`
- `onTabChange?: (tab: EquipmentViewTab) => void`
- `canEdit?: boolean`
- `canManageEquipmentEvents?: boolean`
- `canManageMaintenanceSettings?: boolean`
- `historyError?: string | null`
- `isHistoryLoading?: boolean`

События:

- вызывает `onTabChange` при смене вкладки;
- инициирует переход в редактирование через `navigateWithViewTransition`.

Зависимости:

- `EquipmentCardTabs`
- `EquipmentDetailsTab`
- `EquipmentHistoryTab`
- `EquipmentDocumentsPanel`
- `EquipmentEventsPanel`
- `MaintenanceSettingsPanel`
- `useEquipmentPhotos`

## EquipmentCardTabs

Назначение:

- список вкладок карточки оборудования.

Ответственность:

- отрисовать все доступные вкладки;
- поддерживать ARIA tabs pattern;
- обрабатывать клики и клавиатурную навигацию.

Props:

- `activeTab: EquipmentViewTab`
- `onTabChange: (tab: EquipmentViewTab) => void`

События:

- вызывает `onTabChange` при клике;
- вызывает `onTabChange` при `ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown`, `Home`, `End`.

Зависимости:

- `equipment-card-tabs.ts`

## EquipmentDetailsTab

Назначение:

- панель основной карточки оборудования.

Ответственность:

- собрать секции карточки;
- отрисовать главную секцию с фотографиями;
- отрисовать вторичные секции и текстовые блоки.

Props:

- `equipment: EquipmentCard`
- `photos: EquipmentFile[]`
- `isPhotosLoading: boolean`
- `photosError: string | null`

Зависимости:

- `EquipmentMainDataSection`
- `EquipmentCardGrid`
- `EquipmentTextBlock`
- `equipment-card-view-model.tsx`

## EquipmentDocumentsPanel

Назначение:

- вложенный модуль документов оборудования.

Использование в карточке:

- монтируется только на вкладке `documents`;
- вызывается в режиме `mode="view"`;
- получает `visibleId`.

Карточка не управляет внутренним состоянием документов и не обрабатывает их API самостоятельно.

## EquipmentEventsPanel

Назначение:

- вложенный модуль событий оборудования.

Использование в карточке:

- монтируется только на вкладке `events`;
- получает `visibleId`;
- получает `equipmentStatus`;
- получает флаг `canManageEvents`.

Карточка не управляет состоянием событий и не знает об их внутренних модалях.

## MaintenanceSettingsPanel

Назначение:

- вложенный модуль настроек обслуживания.

Использование в карточке:

- монтируется только на вкладке `maintenance-settings`;
- получает `visibleId`;
- получает флаг `canManage`.

## EquipmentHistoryTab

Назначение:

- панель истории изменений.

Ответственность:

- показать ошибку загрузки истории;
- показать состояние загрузки;
- отрисовать `EquipmentHistoryView` при успешной загрузке.

Props:

- `history: EquipmentHistoryItem[]`
- `error: string | null`
- `isLoading: boolean`

## EquipmentHistoryView

Назначение:

- визуализация списка истории изменений.

Ответственность:

- сгруппировать близкие записи;
- различать file actions и обычные изменения;
- форматировать даты и пустые значения;
- показать empty state.

Props:

- `history: EquipmentHistoryItem[]`

## EquipmentMainDataSection

Назначение:

- главная секция вкладки `details`.

Ответственность:

- показать заголовок секции;
- показать галерею фотографий;
- показать основной grid карточки.

Props:

- `title: string`
- `fields: EquipmentCardField[]`
- `photos: EquipmentFile[]`
- `isPhotosLoading?: boolean`
- `photoError?: string | null`

## EquipmentPhotoGallery

Назначение:

- просмотр фотографий оборудования внутри карточки.

Ответственность:

- отсортировать фотографии;
- показать активную фотографию;
- показать placeholder при отсутствии данных;
- переключать фотографии;
- открывать полноэкранный preview.

Props:

- `photos: EquipmentFile[]`
- `isLoading?: boolean`
- `error?: string | null`

Локальные состояния:

- `activeIndex`
- `isPreviewOpen`

## ImagePreviewModal

Назначение:

- полноэкранный просмотр одной фотографии.

Ответственность:

- отрисовать диалог через portal;
- блокировать прокрутку страницы;
- закрывать по backdrop, кнопке и `Escape`;
- удерживать фокус внутри модального окна;
- возвращать фокус после закрытия;
- поддерживать переключение между фотографиями при наличии `onNext` и `onPrevious`.

Props:

- `ariaLabel: string`
- `imageUrl: string`
- `imageAlt?: string`
- `counterLabel?: string`
- `onClose: () => void`
- `onPrevious?: () => void`
- `onNext?: () => void`

## EquipmentTextBlock

Назначение:

- отображение одного текстового блока карточки.

Ответственность:

- показать заголовок блока;
- форматировать пустое значение через `formatNullableText`.

Props:

- `label: string`
- `value: string | null`

## EquipmentCardGrid

Назначение:

- универсальный grid полей карточки.

Ответственность:

- отрисовать `dl > dt + dd` для списка полей.

Props:

- `items: EquipmentCardField[]`
