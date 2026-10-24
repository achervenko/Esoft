# Мобильные модалки

Для обычных форм используйте `AdminModal` или `GuardedAdminModal`: мобильное
поведение уже подключено. Другие виды диалогов пока не переводились автоматически.

## Подключение к существующему диалогу

Для модалки со своей разметкой можно использовать `useMobileDialogViewport` и
`MobileDialog.css`. Хук принимает refs окна и полноэкранной подложки и возвращает
признак мобильной ширины (`isMobile`, `max-width: 760px`) и готовность окна (`isReady`).

```tsx
import { useRef } from "react";
import { DialogPopupReadyContext } from "./DialogPopupReadyContext";
import { useMobileDialogViewport } from "./useMobileDialogViewport";
import "./MobileDialog.css";

const dialogRef = useRef<HTMLElement | null>(null);
const backdropRef = useRef<HTMLDivElement | null>(null);
const { isMobile, isReady } = useMobileDialogViewport(dialogRef, backdropRef);

// Внутри portal:
<DialogPopupReadyContext.Provider value={isReady}>
  <div
    ref={backdropRef}
    className="custom-backdrop mobile-dialog-backdrop"
    role="presentation"
  >
    <section
      ref={dialogRef}
      className="custom-dialog mobile-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      {/* Заголовок и прокручиваемая форма */}
    </section>
  </div>
</DialogPopupReadyContext.Provider>;
```

Требования к базовой разметке:

- Подложка: `position: fixed; inset: 0`. Затемнение всегда покрывает всю страницу.
- Окно: `position: absolute`, ограниченная ширина, `overflow: hidden`.
- Тело формы прокручивается внутри окна; например, сетка
  `grid-template-rows: auto minmax(0, 1fr)` и `overflow-y: auto` у тела.
- Окно монтируется при открытии и размонтируется при закрытии.
- Автофокус, удержание/возврат фокуса, Escape и обработчики закрытия остаются
  ответственностью компонента. Для обычных форм они уже есть в `AdminModal`.
- Анимацию изменения высоты отключайте на мобильной ширине, используя `isMobile`.

Короткое окно центрируется в видимой области над клавиатурой. Длинное ограничено
её высотой и прокручивается внутри. Координаты берутся из `visualViewport`; при его
отсутствии используется CSS `100dvh`.

Если поле уже сфокусировано при открытии, окно проявляется после 80 мс без событий
изменения viewport. Максимальное ожидание — 500 мс, чтобы аппаратная клавиатура или
отсутствие resize не оставили окно невидимым. Автофокус и ввод не задерживаются.
Во время ожидания элементы окна не принимают нажатия указателем. После ожидания
используется проявление за 320 мс; `prefers-reduced-motion` отключает анимацию.

При переносе каждого нового вида модалки проверяйте короткую и длинную форму,
реальную клавиатуру на телефоне, закрытие/возврат фокуса, ошибки валидации,
выпадающие списки и прежнее поведение на ПК. Уменьшение окна в браузере не заменяет
проверку экранной клавиатуры.

`AdminModal` передаёт готовность через `DialogPopupReadyContext` автоматически.
Общие `SearchSelect` и `SelectDropdown` не выводят портальные меню до готовности
окна; при появлении пересчитывают координаты. Автофокус и ввод остаются доступны.
`SearchSelect` использует анимацию раскрытия за 360 мс; уменьшение анимации учитывается.

Для поиска в динамически добавленной строке передайте `focusOnMount` в
`SearchSelect` только новой строке (с уникальным стабильным `key`). Общий
`useDialogSearchFocus` фокусирует поле без прокрутки внешних контейнеров,
прокручивает форму на ПК и ждёт остановки поля перед показом меню. На телефоне
прокрутку после клавиатуры выполняет `AdminModal`, чтобы не было двойного движения.
Готовность поля объединяется с готовностью модалки автоматически.
Для раскрытия строго вниз используйте `placement="bottom"`.
