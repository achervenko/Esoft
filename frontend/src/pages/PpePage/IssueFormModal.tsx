import { IssueDraftRow } from "./IssueDraftRow";
import { buildIssuePayload, comparable, type Draft } from "./issue-form-model";
import { businessToday, formatPpeDate } from "../../modules/ppe-ui/ppe-presentation";
import { useCallback, useRef, useState } from "react";
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
  const savingRef = useRef(false);
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
        className="ppe-form ppe-issue-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (savingRef.current) return;
          if (!canSubmit) {
            setError("Выберите доступные СИЗ и их активные размеры.");
            return;
          }
          const payloadItems = buildIssuePayload(drafts);
          savingRef.current = true;
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
            .finally(() => {
              savingRef.current = false;
              setSaving(false);
            });
        }}
      >
        <div className="ppe-issue-form-heading">
          <div className="ppe-issue-form-employee">
            <strong>{employeeName(employee)}</strong>
            <p>{employee.position}</p>
          </div>
          <label className="ppe-issue-form-date">
            <span>Дата выдачи</span>
            <input type="text" readOnly value={formatPpeDate(issuedAt ?? businessToday())} />
          </label>
        </div>
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
        <div className="ppe-issue-form-actions">
        <button
          className="admin-primary-button"
          disabled={saving || !canSubmit}
        >
          {saving ? "Сохранение..." : "Подтвердить"}
        </button>
        </div>
      </form>
    </GuardedAdminModal>
  );
}
