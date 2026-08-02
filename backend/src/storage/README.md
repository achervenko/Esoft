# Backend Storage Module

## Назначение

`backend/src/storage` - универсальный backend-модуль для файлов, привязанных к бизнес-сущностям.

Модуль отвечает за:

- запись метаданных в `StorageFile`;
- загрузку и чтение объектов через S3/MinIO;
- owner-bound доступ к файлам;
- runtime-валидацию файла и `documentType`;
- policy-правила для форматов, single и primary;
- soft delete;
- генерацию и кеширование image preview;
- audit и owner-level locks внутри транзакций.

Storage не должен знать бизнес-логику оборудования. `equipment` сейчас только один из consumers. Модуль работает через generic `StorageOwnerContext`.

## Основные понятия

```ts
type StorageOwnerContext = {
  module: StorageOwnerModule;
  entityType: string;
  entityId: number;
};
```

- `module` - область владельца, сейчас в Prisma есть `StorageOwnerModule.EQUIPMENT`.
- `entityType` - строковый тип сущности внутри модуля, например `equipment`.
- `entityId` - внутренний DB id бизнес-сущности.

`StorageDocumentType` - Prisma enum типа документа. Текущие значения:

- `passport`
- `maintenance_instruction`
- `equipment_photo`
- `supporting_document`

`StorageFile` хранит `bucket`, `objectKey`, `originalName`, `mimeType`, `sizeBytes`, `documentType`, `isPrimary`, owner-поля, uploader и `deletedAt`.

Важно различать `StorageFile.id` (id файла), `owner.entityId` (внутренний id владельца) и `visibleId` оборудования (публичный id из route). Storage использует внутренний owner `entityId`; преобразование `visibleId -> internal id` делает business-модуль до вызова storage.

## Owner-bound access / security

Доступ к пользовательскому файлу всегда должен идти через owner context.

Нельзя искать файл только по `fileId`. Правильный active lookup включает:

```ts
{
  id: fileId,
  ownerModule: owner.module,
  ownerEntityType: owner.entityType,
  ownerEntityId: owner.entityId,
  deletedAt: null,
}
```

Это защита от IDOR: пользователь не должен получить чужой файл, просто поменяв `fileId`.

Текущий equipment flow:

```text
visibleId из route
-> EquipmentService.findStorageOwnerByVisibleId(...)
-> StorageOwnerContext с internal equipment id
-> StorageFileService / StorageOwnerService
-> lookup файла в рамках owner
```

Глобальные ownerless endpoints вида `/api/files/:fileId` добавлять нельзя. Новый API должен быть привязан к business owner route или другому проверенному owner context.

## Архитектура

- `StorageModule` - dynamic global module через `StorageModule.register(policyConfig)`.
- `StorageFileService` - facade для `list/upload/download/preview/softDelete/setPrimary`.
- `StorageOwnerService` - active lookup по owner и owner + file id.
- `StorageFileUploadService` - normalization, validation, policy check, object upload, compensation.
- `StorageFileUploadTransactionService` - owner lock, active files, policy, DB create, audit.
- `StorageFilePolicyService` - document rules, extension/MIME/content, single и primary rules.
- `StorageFilePrimaryService` - primary в рамках `owner + documentType`.
- `StorageImagePreviewService` - preview cache, size guards, WebP generation.
- `StorageObjectService` - S3/MinIO `put/get/delete/head`.
- `StorageOwnerLockService` - PostgreSQL transaction advisory lock по owner scope.
- `storage-file.validation.ts` - runtime-валидация upload input и document type.
- `storage-file-names.helper.ts` - object keys, extensions, filename normalization.

## Upload flow

```text
1. normalizeUploadedFileInput
2. assertValidStorageFile
3. assertValidStorageDocumentType
4. StorageFilePolicyService.assertFileMatchesDocumentType
5. createStorageObjectKey
6. StorageObjectService.putObject
7. DB transaction:
   - StorageOwnerLockService.lock
   - load active owner files
   - assertDocumentCanBeAdded
   - shouldMakePrimary
   - create StorageFile
   - audit FILE_UPLOAD
8. commit
9. если DB transaction упала после putObject - удалить orphan object
```

`UploadedFileInput.size` не является trusted source. В `StorageFileUploadService` размер всегда нормализуется из `file.buffer.length`, и дальше используется только нормализованный file.

Object storage и Postgres не имеют общей транзакции. Поэтому объект загружается до DB-записи, а при ошибке DB выполняется компенсация через `deleteObject`. Если cleanup orphan-объекта падает, это логируется, но не заменяет основной upload error contract.

## File validation

Общая валидация: файл должен быть передан, `buffer` должен быть непустым, `buffer.length` не должен превышать `MAX_FILE_SIZE_BYTES` (`25 MB`), `originalname` не должен быть пустым, `documentType` проверяется в runtime по Prisma enum.

Policy-валидация зависит от `documentRules`:

- `allowedExtensions`;
- `allowedMimeTypes`;
- `validateContent`;
- `maxPixelCount` для image decode.

Для image rule проверяются extension, declared MIME, magic bytes и allowed MIME. Magic bytes сейчас распознаются для JPEG, PNG и WebP. После этого Sharp делает decode/rotate с `limitInputPixels`, если в rule передан `maxPixelCount`.

Для PDF rule проверяется `%PDF-` в начале и наличие `%%EOF`.

Это не antivirus, не sandbox и не полноценная security-проверка PDF. Это прикладная runtime-валидация формата.

## Policy configuration

Storage регистрируется в `AppModule`:

```ts
StorageModule.register({
  documentRules: {
    [StorageDocumentType.equipment_photo]: {
      allowedExtensions: ['jpg', 'jpeg', 'png', 'webp'],
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      maxPixelCount: 120_000_000,
      validateContent: 'image',
    },
    [StorageDocumentType.passport]: {
      allowedExtensions: ['pdf'],
      allowedMimeTypes: ['application/pdf'],
      validateContent: 'pdf',
    },
  },
  primaryDocumentTypes: [StorageDocumentType.equipment_photo],
  singleDocumentTypes: [StorageDocumentType.passport],
});
```

`documentRules` задает ограничения конкретного `StorageDocumentType`. `primaryDocumentTypes` задает типы, для которых можно выбрать основной файл. `singleDocumentTypes` задает типы, для которых у одного owner может быть только один active файл.

Business-specific правила находятся в composition root (`AppModule`), а не внутри generic storage services. `StorageFilePolicyService` делает snapshot входного конфига: массивы rules копируются, primary/single хранятся в `Set`.

## Primary files

Primary всегда scoped by:

```text
owner + documentType
```

При `setPrimaryFile`:

- файл ищется только как active file в рамках owner;
- проверяется, что его `documentType` поддерживает primary;
- previous primary ищется среди active files того же `owner + documentType`;
- `isPrimary = false` снимается только с active files того же `owner + documentType`;
- другие `documentType` не затрагиваются.

При удалении primary следующий primary выбирается только среди active files того же `owner + documentType`.

При upload новый файл становится primary, если тип поддерживает primary и среди active files этого же типа еще нет primary.

## Soft delete

Удаление файла - soft delete через `deletedAt`.

Active lookups используют `deletedAt: null`, поэтому soft-deleted файл не должен возвращаться в list, download, preview, set-primary и active owner lookups.

`softDeleteFile` выполняется в Prisma transaction:

```text
lock owner
-> find active file by owner + fileId
-> load active owner files
-> calculate displayName for audit
-> set deletedAt
-> assign next primary if needed
-> audit FILE_DELETE
-> commit
```

Физический объект в MinIO при soft delete сейчас не удаляется. Отдельного purge/retention scheduler в текущем коде нет.

## Object keys

Формат object key:

```text
<module>/<entityType>/<entityId>/<documentType>/<uuid>.<extension>
```

Segments строятся из owner context и `documentType`; unsafe chars заменяются на `_`; пустой segment становится `unknown`; пользовательский filename не используется для object key; UUID используется для уникальности object key; extension берется из filename, MIME или fallback `bin`.

## Image previews

Preview поддерживает размеры `small` (`48x48`) и `medium` (`256x256`).

Cache key:

```text
storage-previews/<storageFile.id>/<size>.webp
```

Flow:

```text
1. getObjectOrNull(previewKey)
2. если cache hit - вернуть cached preview
3. проверить StorageFile.sizeBytes <= 50 MB
4. getObject(source object)
5. проверить object contentLength <= 50 MB
6. прочитать stream в buffer с hard max 50 MB
7. ImageProcessingService.createWebpVersions(...)
8. putObject(previewKey)
9. вернуть Readable из preview buffer
```

Есть три уровня защиты от слишком большого source: `StorageFile.sizeBytes`, `StoredObject.contentLength`, фактически прочитанные bytes из stream.

Preview вызывается только для image-файлов, когда caller передал `size`. PDF и image без `size` читаются как оригинальный object.

## Audit

```ts
type StorageAuditContext = {
  actionModule: AuditModule;
};
```

`entityId` и `entityType` для audit всегда берутся из `owner`. Caller не может случайно создать/удалить файл для одной сущности, а audit записать на другую.

Audit пишется внутри тех же Prisma transactions, что и upload metadata create, delete и set-primary. Если audit write падает внутри transaction, основное изменение тоже откатывается.

## Owner lock / concurrency

`StorageOwnerLockService` использует PostgreSQL transaction advisory lock:

```text
storage_files:<owner.module>:<owner.entityType>:<owner.entityId>
```

Lock берется внутри transaction перед чтением active files и изменением storage metadata.

Lock нужен, чтобы не допустить гонки single document rule, стабилизировать primary selection и синхронизировать конкурентные upload/set-primary/delete в рамках одного owner.

## Equipment integration

Текущий consumer - `EquipmentFilesController`:

```text
GET    /api/equipment/:visibleId/files
POST   /api/equipment/:visibleId/files
GET    /api/equipment/:visibleId/files/:fileId/download
GET    /api/equipment/:visibleId/files/:fileId/preview
DELETE /api/equipment/:visibleId/files/:fileId
PATCH  /api/equipment/:visibleId/files/:fileId/primary
```

Controller получает owner через `EquipmentService.findStorageOwnerByVisibleId`, для mutating операций проверяет роль через `assertCanManageFiles`, передает `audit: { actionModule: AuditModule.EQUIPMENT }`, валидирует multipart `documentType` через `ParseEnumPipe`, а preview `size` ограничивает значениями `small` и `medium`.

## Добавление нового DocumentType

1. Добавить значение в Prisma `StorageDocumentType`.
2. Создать migration.
3. Добавить policy rule в `StorageModule.register(...)` в composition root.
4. Определить `allowedExtensions`, `allowedMimeTypes`, `validateContent`, `maxPixelCount`, `primaryDocumentTypes`, `singleDocumentTypes`.
5. Добавить business endpoint/UI integration.
6. Использовать только owner-bound context.
7. Добавить regression tests рядом с production files.
8. Выполнить Prisma migration на production через принятый deployment flow.

Не переносить новые business-specific правила обратно внутрь generic storage services.

## Добавление нового owner module / entity

Business module должен сам найти бизнес-сущность, проверить существование и доступ, сформировать `StorageOwnerContext` и передать owner в `StorageFileService`.

Storage не должен делать business lookup и не должен принимать arbitrary `entityId` от клиента как trusted owner. Route/API должен оставаться owner-bound.

## Ошибки и контракты

Фактические storage/image error codes: `FILE_REQUIRED`, `EMPTY_FILE`, `FILE_TOO_LARGE`, `UNSUPPORTED_FILE_FORMAT`, `DOCUMENT_TYPE_REQUIRED`, `UNSUPPORTED_DOCUMENT_TYPE`, `DOCUMENT_ALREADY_EXISTS`, `UNSUPPORTED_PRIMARY_FILE`, `INVALID_PDF`, `INVALID_IMAGE`, `IMAGE_TOO_SMALL`, `IMAGE_PIXEL_LIMIT_EXCEEDED`, `STORAGE_OBJECT_EMPTY`, `STORAGE_UNAVAILABLE`, `DATABASE_ERROR`, `UPLOAD_FAILED`.

Consumer-level codes в `EquipmentFilesController`: `INVALID_DOCUMENT_TYPE`, `INVALID_PREVIEW_SIZE`, `EQUIPMENT_NOT_FOUND`.

Не добавлять новые коды в README без проверки production-кода.

## Тесты

Regression tests лежат рядом с production files в `backend/src/storage/*.spec.ts`.

Покрываются owner isolation, policy rules, upload normalization, compensation cleanup, transaction owner lock/audit context, primary, validation, object keys и image preview limits/cache.

Команды:

```bash
npm run test --workspace backend -- storage
npm run test --workspace backend
npm run build --workspace backend
```

В backend workspace сейчас нет `typecheck` script, поэтому отдельную команду `npm run typecheck --workspace backend` не использовать до добавления script.

## Инварианты, которые нельзя ломать

- Никогда не искать пользовательский файл только по `fileId`.
- Owner context формирует business module после проверки сущности и доступа.
- Storage не должен знать equipment-specific business logic, а business policy config не должен возвращаться внутрь generic storage services.
- `UploadedFileInput.size` не trusted source; размер брать из `buffer.length`.
- Active file означает `deletedAt: null`; soft-deleted files не должны попадать в list/download/preview/set-primary.
- Primary всегда scoped by `owner + documentType`.
- Single document rule проверяется внутри transaction после owner lock.
- Upload object должен компенсироваться через delete при DB failure.
- Audit entity всегда берется из owner; caller передает только `actionModule`.
- Object key не должен строиться из пользовательского filename.
- Preview generation сначала проверяет cache, затем применяет size guards.
