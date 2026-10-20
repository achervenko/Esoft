import { GuardedAdminModal } from "../../shared/ui/GuardedAdminModal";
import { formatPpeDate } from "../../modules/ppe-ui/ppe-presentation";
import { formatPpeQuantity } from "../../modules/ppe-ui/ppe-presentation";
import { useRef, useState } from "react";
import { ppeApi, type PpeIssue } from "../../shared/api/ppe";
import { canIssuePpe } from "../../modules/ppe-permissions/ppe-permissions";
import { AdminModal } from "../../shared/ui/AdminModal";
import { Field, Message } from "../../modules/ppe-ui/ppe-ui";
import {
  ppeError,
  sizeLabel,
  typeLabels,
} from "../../modules/ppe-ui/ppe-presentation";
import { usePpeQuery } from "../../modules/ppe-ui/usePpeQuery";
import { PpeQueryState } from "../../modules/ppe-ui/PpeQueryState";
export function IssueDetailsModal({
  id,
  permissions,
  onClose,
  onChanged,
}: {
  id: number;
  permissions: readonly string[] | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const details = usePpeQuery(`issue:${id}`, (signal) =>
    ppeApi.issueDetails(id, signal),
  );
  const [cancel, setCancel] = useState(false);
  if (cancel)
    return (
      <CancelIssueModal
        id={id}
        onClose={() => setCancel(false)}
        onCancelled={() => {
          details.reload();
          onChanged();
        }}
      />
    );
  return (
    <AdminModal
      title={
        details.data
          ? `${formatPpeDate(details.data.issuedAt)} — ${details.data.employeeName}`
          : "Выдача"
      }
      onClose={onClose}
      className="ppe-issue-details-modal"
    >
      <div className="ppe-form">
        <PpeQueryState {...details} />
        {details.data && (
          <>
            <IssueSnapshot issue={details.data} hideHeaderFields />
            {details.data.status === "ISSUED" && canIssuePpe(permissions) && (
              <button
                className="admin-secondary-button"
                onClick={() => setCancel(true)}
              >
                Отменить выдачу
              </button>
            )}
          </>
        )}
      </div>
    </AdminModal>
  );
}
export function IssueSnapshot({
  issue,
  hideHeaderFields = false,
}: {
  issue: PpeIssue;
  hideHeaderFields?: boolean;
}) {
  const fields: [string, string][] = [
    ["Сотрудник", issue.employeeName],
    ["Должность", issue.position],
    [
      "Вид выдачи",
      issue.issueType === "REGULAR" ? "Нормативная" : "Дополнительная",
    ],
    [
      "По норме",
      issue.normPpeName
        ? `${issue.normPpeArticle} / ${issue.normPpeName}`
        : "Не по норме",
    ],
    ["Выдано фактически", `${issue.article} / ${issue.name}`],
    ["Тип СИЗ", typeLabels[issue.ppeItemTypeSnapshot]],
    ["Количество", formatPpeQuantity(issue.quantity, issue.unit)],
    ["Размер / ростовка", sizeLabel(issue.sizeValue, issue.heightValue)],
    ["Нормативная дата", formatPpeDate(issue.scheduledAt)],
    ["Дата выдачи", formatPpeDate(issue.issuedAt)],
    ["Выдал", issue.issuedByName],
    ["Статус", issue.status === "ISSUED" ? "Выдано" : "Отменено"],
    ["Комментарий", issue.comment ?? "—"],
  ];
  if (issue.status === "CANCELLED")
    fields.push(
      [
        "Дата отмены",
        issue.cancelledAt
          ? new Date(issue.cancelledAt).toLocaleString("ru-RU")
          : "—",
      ],
      ["Отменил", issue.cancelledByName ?? "—"],
      ["Причина отмены", issue.cancellationReason ?? "—"],
    );
  return (
    <dl className="ppe-snapshot">
      {fields
        .filter(
          ([label]) =>
            !hideHeaderFields ||
            (label !== "Сотрудник" && label !== "Дата выдачи"),
        )
        .map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
    </dl>
  );
}
function CancelIssueModal({
  id,
  onClose,
  onCancelled,
}: {
  id: number;
  onClose: () => void;
  onCancelled: () => void;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <GuardedAdminModal
      hasChanges={reason.trim() !== ""}
      title="Отменить выдачу?"
      onClose={onClose}
      isCloseDisabled={saving}
    >
      {(requestLeave) => (
        <form
          className="ppe-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (savingRef.current || !reason.trim()) return;
            savingRef.current = true;
            setSaving(true);
            setError(null);
            void ppeApi
              .cancel(id, reason.trim())
              .then(() => {
                onCancelled();
                onClose();
              })
              .catch((err) => {
                savingRef.current = false;
                setSaving(false);
                setError(ppeError(err));
              });
          }}
        >
          <Field label="Причина">
            <textarea
              required
              maxLength={1000}
              disabled={saving}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <Message error={error} />
          <div className="ppe-actions">
            <button
              className="admin-secondary-button"
              type="button"
              disabled={saving}
              onClick={() => requestLeave(onClose)}
            >
              Назад
            </button>
            <button
              className="admin-primary-button"
              disabled={saving || !reason.trim()}
            >
              {saving ? "Сохранение..." : "Подтвердить отмену"}
            </button>
          </div>
        </form>
      )}
    </GuardedAdminModal>
  );
}
