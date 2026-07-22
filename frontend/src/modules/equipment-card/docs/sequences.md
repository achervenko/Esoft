# Последовательности

## Открытие карточки

```mermaid
sequenceDiagram
  participant Page as Страница оборудования
  participant Card as EquipmentCardView
  participant Hook as useEquipmentPhotos
  participant API as getEquipmentFiles

  Page->>Card: передаёт equipment, history, initialTab, returnTo
  Card->>Card: инициализирует activeTab
  alt activeTab = details
    Card->>Hook: enabled=true, visibleId
    Hook->>API: GET files
    API-->>Hook: EquipmentFile[]
    Hook-->>Card: photos, isLoading=false
  else другая вкладка
    Card->>Hook: enabled=false
  end
```

## Переключение вкладок

```mermaid
sequenceDiagram
  participant User as Пользователь
  participant Tabs as EquipmentCardTabs
  participant Card as EquipmentCardView
  participant Hash as window.location.hash

  User->>Tabs: click / keyboard navigation
  Tabs->>Card: onTabChange(tab)
  Card->>Card: setActiveTab(tab)
  Card->>Card: onTabChange?.(tab)
  Card->>Hash: обновление hash через buildHashRoute()
```

## Загрузка фотографий

```mermaid
sequenceDiagram
  participant Card as EquipmentCardView
  participant Hook as useEquipmentPhotos
  participant API as getEquipmentFiles
  participant Gallery as EquipmentPhotoGallery

  Card->>Hook: enabled=true, visibleId
  Hook->>API: getEquipmentFiles(visibleId)
  API-->>Hook: EquipmentFile[]
  Hook->>Hook: filter documentType === equipment_photo
  Hook-->>Gallery: photos, error, isLoading
```

## Открытие полноэкранного просмотра

```mermaid
sequenceDiagram
  participant User as Пользователь
  participant Gallery as EquipmentPhotoGallery
  participant Modal as ImagePreviewModal

  User->>Gallery: click по активной фотографии
  Gallery->>Gallery: setIsPreviewOpen(true)
  Gallery->>Modal: render portal
  Modal->>Modal: focus внутрь диалога
```

## Переход в редактирование

```mermaid
sequenceDiagram
  participant User as Пользователь
  participant Card as EquipmentCardView
  participant Nav as navigateWithViewTransition

  User->>Card: click "Редактировать"
  Card->>Card: preventDefault()
  Card->>Card: buildHashRoute(edit, returnTo, tab?)
  Card->>Nav: navigateWithViewTransition(editHref)
```

## Возврат назад

Возврат назад выполняется не самим модулем карточки, а внешним роутингом страницы через сохранённый параметр:

- `returnTo`

Карточка только сохраняет это значение при:

- переходе между вкладками
- переходе в редактирование
