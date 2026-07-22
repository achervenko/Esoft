# Accessibility

## Вкладки

`EquipmentCardTabs` реализует ARIA tabs pattern.

Используются:

- `role="tablist"` на контейнере
- `role="tab"` на кнопках вкладок
- `aria-selected`
- `tabIndex={0}` только для активной вкладки
- `tabIndex={-1}` для остальных вкладок
- `id="equipment-tab-{tab}"`
- `aria-controls="equipment-panel-{tab}"`

## Панели вкладок

Панели используют:

- `role="tabpanel"`
- `id="equipment-panel-{tab}"`
- `aria-labelledby="equipment-tab-{tab}"`

Это реализовано для:

- `details`
- `documents`
- `events`
- `maintenance-settings`
- `history`

## Клавиатурное управление вкладками

Поддерживаются клавиши:

- `ArrowRight`
- `ArrowDown`
- `ArrowLeft`
- `ArrowUp`
- `Home`
- `End`

При обработке:

- вызывается `preventDefault()`
- активная вкладка меняется
- фокус переносится на новую вкладку

## Диалог просмотра фотографии

`ImagePreviewModal` использует:

- `role="dialog"`
- `aria-modal="true"`
- `aria-label`

Компонент рендерится через portal в `document.body`.

## Управление фокусом в модалке

При открытии:

- фокус переводится на `[autofocus]`, первый focusable-элемент или сам диалог

При закрытии:

- фокус возвращается на элемент, который был активным до открытия

## Escape

`ImagePreviewModal` обрабатывает:

- `Escape`

и закрывает диалог.

## Tab и Shift+Tab

Модалка реализует focus trap:

- `Tab` циклически переводит фокус вперёд по focusable-элементам
- `Shift+Tab` циклически переводит фокус назад

Если focusable-элементов нет:

- фокус остаётся на самом диалоге

## Семантические элементы

Для вывода полей карточки используется:

- `dl`, `dt`, `dd`

Для списков истории используются обычные секции и статьи, а не таблица HTML, потому что история имеет смешанный формат:

- file actions
- grouped field changes
