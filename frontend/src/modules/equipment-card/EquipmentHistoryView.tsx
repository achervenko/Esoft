import { FileCheck2, FileX2 } from "lucide-react";
import type { EquipmentHistoryItem } from "../../shared/api/equipment/equipment.types";
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

const text = {
  changeCountOne: "1 \u043f\u043e\u043b\u0435",
  changeCountFew: "\u043f\u043e\u043b\u044f",
  changeCountMany: "\u043f\u043e\u043b\u0435\u0439",
  create: "\u0421\u043e\u0437\u0434\u0430\u043d\u0438\u0435",
  dateFallback:
    "\u0414\u0430\u0442\u0430 \u043d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d\u0430",
  document: "\u0414\u043e\u043a\u0443\u043c\u0435\u043d\u0442",
  documentDeleted:
    "\u0414\u043e\u043a\u0443\u043c\u0435\u043d\u0442 \u0443\u0434\u0430\u043b\u0451\u043d",
  documentUploaded:
    "\u0414\u043e\u043a\u0443\u043c\u0435\u043d\u0442 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043d",
  empty:
    "\u041f\u043e \u044d\u0442\u043e\u0439 \u043a\u0430\u0440\u0442\u043e\u0447\u043a\u0435 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442 \u0437\u0430\u043f\u0438\u0441\u0435\u0439.",
  field: "\u041f\u043e\u043b\u0435",
  historyTitle:
    "\u0418\u0441\u0442\u043e\u0440\u0438\u044f \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u0439",
  newValue:
    "\u041d\u043e\u0432\u043e\u0435 \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435",
  notSpecified: "\u041d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d\u043e",
  oldValue:
    "\u0421\u0442\u0430\u0440\u043e\u0435 \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435",
  update: "\u0418\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u0435",
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
  const fileName = getFileHistoryName(group);
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

      <div>
        <strong>{fileName}</strong>
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

function getFileHistoryName(group: EquipmentHistoryGroup) {
  const item = group.items[0];
  const value = group.action === "FILE_DELETE" ? item?.oldValue : item?.newValue;

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
    "\u043d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d\u043e"
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
    timeZone: "UTC",
    year: "numeric",
  }).format(date)} \u041c\u0421\u041a`;
}
