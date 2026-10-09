import { IssueDraftRow } from "./IssueDraftRow";
import { buildIssuePayload, comparable, type Draft } from "./issue-form-model";
import { formatPpeDate } from "../../modules/ppe-ui/ppe-presentation";
import { useCallback, useState } from "react";
import {
  ppeApi,
  type PpeEmployee,
  type PpeItem,
  type PlanRow,
  type IssueResult,
} from "../../shared/api/ppe";
import { GuardedAdminModal } from "../../shared/ui/GuardedAdminModal";
import { Message } from "../../modules/ppe-ui/ppe-ui";
import { employeeName, ppeError } from "../../modules/ppe-ui/ppe-presentation";
export function IssueFormModal({
  employee,
  items,
  regularRows,
  issuedAt,
  onClose,
  onCreated,
}: {
  employee: PpeEmployee;
  items: PpeItem[];
  regularRows: PlanRow[] | null;
  issuedAt?: string;
  onClose: () => void;
  onCreated: (result: IssueResult[]) => void;
}) {
  const [drafts, setDrafts] = useState<Draft[]>(
    regularRows
      ? regularRows.map((norm, key) => ({
          key,
          ppeItemId: norm.ppeItemId,
          sizeId: "",
          comment: "",
          quantity: "",
          ready: false,
          requiresSelection: false,
          norm,
        }))
      : [
          {
            key: 0,
            ppeItemId: 0,
            sizeId: "",
            comment: "",
            quantity: "1",
            ready: false,
            requiresSelection: false,
            norm: null,
          },
        ],
  );
  const [baseline, setBaseline] = useState(drafts);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSubmit =
    drafts.length > 0 &&
    drafts.every(
      (row) =>
        row.ready &&
        (!row.requiresSelection || Boolean(row.sizeId)) &&
        items.some((item) => item.id === row.ppeItemId && item.isActive),
    );
  const update = useCallback(
    (key: number, patch: Partial<Draft>, automatic = false) => {
      if (automatic)
        setBaseline((current) =>
          current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
        );
      setDrafts((current) =>
        current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
      );
    },
    [],
  );
  return (
    <GuardedAdminModal
      hasChanges={comparable(drafts) !== comparable(baseline)}
      title={regularRows ? "Нормативная выдача" : "Дополнительная выдача"}
      onClose={onClose}
      isCloseDisabled={saving}
      className="ppe-wide-modal"
    >
      <form
        className="ppe-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSubmit) {
            setError("Выберите доступные СИЗ и их активные размеры.");
            return;
          }
          const payloadItems = buildIssuePayload(drafts);
          setSaving(true);
          setError(null);
          void ppeApi
            .issue(Boolean(regularRows), {
              employeeId: employee.id,
              ...(issuedAt ? { issuedAt } : {}),
              items: payloadItems,
            })
            .then((result) => {
              onCreated(result);
              onClose();
            })
            .catch((err) => setError(ppeError(err)))
            .finally(() => setSaving(false));
        }}
      >
        <p>
          <strong>{employeeName(employee)}</strong>
        </p>
        <p className="admin-form-hint">
          {issuedAt
            ? `Дата выдачи: ${formatPpeDate(issuedAt)}`
            : "Дата выдачи будет установлена системой."}
          {regularRows &&
            " Весь набор сохранится одной операцией; при ошибке ни одна выдача не будет записана."}
        </p>
        {drafts.map((row) => (
          <IssueDraftRow
            key={row.key}
            row={row}
            employeeId={employee.id}
            items={items}
            disabled={saving}
            onChange={update}
          />
        ))}
        <Message error={error} />
        <button
          className="admin-primary-button"
          disabled={saving || !canSubmit}
        >
          {saving
            ? "Сохранение..."
            : regularRows && regularRows.length > 1
              ? `Выдать выбранное (${regularRows.length})`
              : "Подтвердить выдачу"}
        </button>
      </form>
    </GuardedAdminModal>
  );
}
