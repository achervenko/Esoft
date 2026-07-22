# Тестирование

## Инструменты

Во frontend для этого модуля настроены:

- `Vitest`
- `React Testing Library`
- `@testing-library/user-event`
- `@testing-library/jest-dom`
- `jsdom`

## Где лежат тесты

Тесты находятся рядом с исходными файлами:

- `EquipmentCardView.spec.tsx`
- `EquipmentCardTabs.spec.tsx`
- `EquipmentDetailsTab.spec.tsx`
- `EquipmentHistoryTab.spec.tsx`
- `EquipmentHistoryView.spec.tsx`
- `EquipmentMainDataSection.spec.tsx`
- `EquipmentPhotoGallery.spec.tsx`
- `EquipmentTextBlock.spec.tsx`
- `EquipmentCardGrid.spec.tsx`
- `use-equipment-photos.spec.tsx`
- `equipment-card-view-model.spec.tsx`
- `equipment-card-navigation.spec.ts`
- `equipment-card-tabs.spec.ts`
- `shared/ui/ImagePreviewModal.spec.tsx`

## Покрываемые сценарии

Текущий набор тестов покрывает:

- парсинг вкладок;
- навигацию с View Transition API и fallback;
- доступность и клавиатурное управление вкладками;
- рендер основной карточки и истории;
- пустые, загрузочные и ошибочные состояния;
- галерею фотографий и открытие preview;
- поведение `ImagePreviewModal`;
- работу `useEquipmentPhotos`;
- синхронизацию `EquipmentCardView` с hash и props.

## Правила написания новых тестов

- проверять поведение через DOM и действия пользователя;
- искать элементы по ролям, доступным именам и тексту;
- не проверять внутренний state React напрямую;
- не делать реальные HTTP-запросы;
- мокировать API через `vi.mock`;
- очищать глобальные моки и изменённые browser API между тестами;
- для модалок и вкладок обязательно проверять accessibility.

## Что обязательно проверять при добавлении нового компонента

- корректный рендер основного состояния;
- обработку пустых данных;
- обработку ошибок;
- пользовательские действия;
- влияние props доступа;
- ARIA-атрибуты и клавиатурное управление, если компонент интерактивный.

## Команды

- `npm test`
- `npm run test:coverage`
- `npm run typecheck`
