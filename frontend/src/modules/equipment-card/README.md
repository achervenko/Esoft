# Карточка оборудования

Документ описывает frontend-модуль просмотра карточки оборудования.

Модуль отвечает за:

- отображение основной карточки оборудования;
- переключение вкладок карточки;
- синхронизацию активной вкладки с hash-маршрутом;
- отображение фотографий оборудования;
- полноэкранный просмотр фотографий;
- отображение истории изменений;
- встраивание соседних модулей документов, событий и настроек обслуживания.

## Где находится модуль

Основная точка входа:

- `EquipmentCardView.tsx`

Связанные файлы модуля:

- `EquipmentCardTabs.tsx`
- `EquipmentDetailsTab.tsx`
- `EquipmentHistoryTab.tsx`
- `EquipmentHistoryView.tsx`
- `EquipmentMainDataSection.tsx`
- `EquipmentPhotoGallery.tsx`
- `EquipmentTextBlock.tsx`
- `EquipmentCardGrid.tsx`
- `equipment-card-navigation.ts`
- `equipment-card-tabs.ts`
- `equipment-card-view-model.tsx`
- `use-equipment-photos.ts`

Модуль использует общую модалку:

- `shared/ui/ImagePreviewModal.tsx`

## Архитектура модуля

Структура основных компонентов:

```text
EquipmentCardView
├── EquipmentCardTabs
├── EquipmentDetailsTab
│   ├── EquipmentMainDataSection
│   │   ├── EquipmentPhotoGallery
│   │   │   └── ImagePreviewModal
│   │   ├── EquipmentCardGrid
│   │   └── EquipmentTextBlock
├── EquipmentDocumentsPanel
├── EquipmentEventsPanel
├── MaintenanceSettingsPanel
└── EquipmentHistoryTab
    └── EquipmentHistoryView
```

`EquipmentCardView` выступает контейнером модуля: он управляет активной вкладкой, синхронизирует её с hash-маршрутом и подключает нужную панель.

`EquipmentDetailsTab` и `EquipmentHistoryTab` отвечают за собственные представления внутри модуля, а документы, события и настройки обслуживания подключаются как внешние вложенные панели.

`equipment-card-view-model.tsx` играет роль View Model: он преобразует DTO оборудования в данные, готовые для отображения секциями, grid-блоками и текстовыми компонентами карточки.

## Что входит в модуль

- контейнер карточки и вкладок;
- представление основной информации об оборудовании;
- локальная логика навигации между вкладками;
- локальная логика фотографий;
- локальная логика истории изменений;
- тесты модуля.

## Что не входит в модуль

- загрузка и редактирование документов оборудования;
- управление событиями оборудования;
- управление настройками обслуживания;
- получение карточки оборудования с backend;
- маршрутизация верхнего уровня страницы.

Документы, события и настройки обслуживания подключаются как отдельные вложенные модули.

## Тесты

Тесты расположены рядом с исходными файлами и покрывают:

- навигацию;
- вкладки;
- фотографии;
- историю изменений;
- accessibility;
- пользовательские хуки.

## Документация

- [Архитектура](./docs/architecture.md)
- [Компоненты](./docs/components.md)
- [Навигация](./docs/navigation.md)
- [Вкладки](./docs/tabs.md)
- [Фотографии](./docs/photos.md)
- [История изменений](./docs/history.md)
- [API](./docs/api.md)
- [Состояние](./docs/state.md)
- [Доступы](./docs/access.md)
- [Accessibility](./docs/accessibility.md)
- [Хуки](./docs/hooks.md)
- [Типы](./docs/types.md)
- [Последовательности](./docs/sequences.md)
- [Тестирование](./docs/testing.md)
- [Ограничения](./docs/limitations.md)
