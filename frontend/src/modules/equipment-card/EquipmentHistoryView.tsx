import type { EquipmentHistoryItem } from '../../shared/api/equipment-api';
import { formatNullableText } from '../../shared/lib/formatters';
import './EquipmentHistoryView.css';

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

const actionLabels: Record<string, string> = {
  CREATE: 'Создание',
  UPDATE: 'Изменение',
};

export function EquipmentHistoryView({ history }: EquipmentHistoryViewProps) {
  const groups = groupHistoryItems(history);

  if (groups.length === 0) {
    return (
      <section className="equipment-history-empty">
        <h2>История изменений</h2>
        <p>По этой карточке пока нет записей.</p>
      </section>
    );
  }

  return (
    <section className="equipment-history-view">
      <h2>История изменений</h2>

      <div className="equipment-history-list">
        {groups.map((group) => (
          <article className="equipment-history-item" key={group.id}>
            <header>
              <div>
                <strong>
                  {actionLabels[group.action] ?? group.action}
                  <span>{formatFieldsCount(group.items.length)}</span>
                </strong>
                <span>{formatHistoryDate(group.createdAt)}</span>
              </div>
              <span>{group.user}</span>
            </header>

            <div className="equipment-history-change-list">
              <div className="equipment-history-change-head">
                <span>Поле</span>
                <span>Старое значение</span>
                <span>Новое значение</span>
              </div>

              {group.items.map((item) => (
                <div className="equipment-history-change-row" key={item.id}>
                  <span>{formatNullableText(item.fieldName)}</span>
                  <span>{formatNullableText(item.oldValue)}</span>
                  <span>{formatNullableText(item.newValue)}</span>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
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

function formatFieldsCount(count: number) {
  if (count === 1) {
    return '1 поле';
  }

  if (count > 1 && count < 5) {
    return `${count} поля`;
  }

  return `${count} полей`;
}

function formatHistoryDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Дата не указана';
  }

  return `${new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(date)} МСК`;
}
