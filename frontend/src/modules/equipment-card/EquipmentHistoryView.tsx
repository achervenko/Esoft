import { FileCheck2, FileX2 } from "lucide-react";
import type { EquipmentHistoryItem } from "../../shared/api/equipment/equipment.types";
import { BUSINESS_TIME_ZONE } from "../../shared/lib/business-date";
import "./EquipmentHistoryView.css";

type EquipmentHistoryViewProps = {
  history: EquipmentHistoryItem[];
};

type EquipmentHistoryGroup = {
  action: string;
  createdAt: string;
  id: string;
  items: EquipmentHistoryItem[];
  user: string;
};

const HISTORY_GROUP_WINDOW_MS = 15_000;
const BUSINESS_TIME_ZONE_LABEL = "МСК";

const text = {
  changeCountOne: "1 поле",
  changeCountFew: "поля",
  changeCountMany: "полей",
  create: "Создание",
  dateFallback: "Дата не указана",
  document: "Документ",
  documentDeleted: "Документ удалён",
  documentUploaded: "Документ загружен",
  empty: "По этой карточке пока нет записей.",
  field: "Поле",
  historyTitle: "История изменений",
  newValue: "Новое значение",
  notSpecified: "Не указано",
  oldValue: "Старое значение",
  update: "Изменение",
};

const actionLabels: Record<string, string> = {
  CREATE: text.create,
  FILE_DELETE: text.documentDeleted,
  FILE_UPLOAD: text.documentUploaded,
  UPDATE: text.update,
};

export function EquipmentHistoryView({ history }: EquipmentHistoryViewProps) {
  const groups = groupHistoryItems(history);

  if (groups.length === 0) {
    return (
      <section className="equipment-history-empty">
        <h2>{text.historyTitle}</h2>
        <p>{text.empty}</p>
      </section>
    );
  }

  return (
    <section className="equipment-history-view">
      <h2>{text.historyTitle}</h2>

      <div className="equipment-history-list">
        {groups.map((group) => {
          const isFileAction = isFileHistoryAction(group.action);

          return (
            <article
              className={
                isFileAction
                  ? "equipment-history-item equipment-history-item--file"
                  : "equipment-history-item"
              }
              key={group.id}
            >
              <header>
                <div>
                  <strong>
                    {actionLabels[group.action] ?? group.action}
                    <span>
                      {isFileAction ? text.document : formatFieldsCount(group.items.length)}
                    </span>
                  </strong>
                  <span>{formatHistoryDate(group.createdAt)}</span>
                </div>
                <span>{group.user}</span>
              </header>

              {isFileAction ? (
                <FileHistoryDetails group={group} />
              ) : (
                <HistoryChangesTable items={group.items} />
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function FileHistoryDetails({ group }: { group: EquipmentHistoryGroup }) {
  const isDelete = group.action === "FILE_DELETE";
  const Icon = isDelete ? FileX2 : FileCheck2;

  return (
    <div
      className={
        isDelete
          ? "equipment-history-file-event equipment-history-file-event--delete"
          : "equipment-history-file-event"
      }
    >
      <span className="equipment-history-file-icon" aria-hidden="true">
        <Icon size={20} />
      </span>

      <div className="equipment-history-file-list">
        {group.items.map((item) => (
          <strong key={item.id}>{getFileHistoryName(group.action, item)}</strong>
        ))}
      </div>
    </div>
  );
}

function HistoryChangesTable({ items }: { items: EquipmentHistoryItem[] }) {
  return (
    <div className="equipment-history-change-list">
      <div className="equipment-history-change-head">
        <span>{text.field}</span>
        <span>{text.oldValue}</span>
        <span>{text.newValue}</span>
      </div>

      {items.map((item) => (
        <div className="equipment-history-change-row" key={item.id}>
          <span data-label={text.field}>{formatNullableHistoryText(item.fieldName)}</span>
          <span data-label={text.oldValue}>
            {formatNullableHistoryText(item.oldValue)}
          </span>
          <span data-label={text.newValue}>
            {formatNullableHistoryText(item.newValue)}
          </span>
        </div>
      ))}
    </div>
  );
}

function groupHistoryItems(history: EquipmentHistoryItem[]) {
  return history.reduce<EquipmentHistoryGroup[]>((groups, item) => {
    const currentTime = new Date(item.createdAt).getTime();
    const latestGroup = groups.at(-1);

    if (latestGroup && canAppendToGroup(latestGroup, item, currentTime)) {
      latestGroup.items.push(item);
      return groups;
    }

    groups.push({
      action: item.action,
      createdAt: item.createdAt,
      id: String(item.id),
      items: [item],
      user: item.user,
    });

    return groups;
  }, []);
}

function canAppendToGroup(
  group: EquipmentHistoryGroup,
  item: EquipmentHistoryItem,
  currentTime: number,
) {
  const groupTime = new Date(group.createdAt).getTime();

  return (
    group.action === item.action &&
    group.user === item.user &&
    Number.isFinite(groupTime) &&
    Number.isFinite(currentTime) &&
    Math.abs(groupTime - currentTime) <= HISTORY_GROUP_WINDOW_MS
  );
}

function isFileHistoryAction(action: string) {
  return action === "FILE_UPLOAD" || action === "FILE_DELETE";
}

function getFileHistoryName(
  action: EquipmentHistoryGroup["action"],
  item: EquipmentHistoryItem,
) {
  const value = action === "FILE_DELETE" ? item.oldValue : item.newValue;

  return formatNullableHistoryText(value);
}

function formatFieldsCount(count: number) {
  if (count === 1) {
    return text.changeCountOne;
  }

  if (count > 1 && count < 5) {
    return `${count} ${text.changeCountFew}`;
  }

  return `${count} ${text.changeCountMany}`;
}

function formatNullableHistoryText(value: string | null) {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return text.notSpecified;
  }

  if (
    normalizedValue.toLocaleLowerCase("ru-RU") ===
    "не указано"
  ) {
    return text.notSpecified;
  }

  return normalizedValue;
}

function formatHistoryDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return text.dateFallback;
  }

  return `${new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
  }).format(date)} ${BUSINESS_TIME_ZONE_LABEL}`;
}
