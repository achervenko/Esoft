import { EmployeeIssueCard } from "./EmployeeIssueCard";
import { IssuePlanTable } from "./IssuePlanTable";
import { IssueResultMessage } from "./IssueResultMessage";
import { EmployeeSearch } from "./EmployeeSearch";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import {
  ppeApi,
  type PpeEmployee,
  type PpeItem,
  type PlanRow,
  type IssueResult,
} from "../../shared/api/ppe";
import {
  canIssuePpe,
  canBackdatePpeIssue,
} from "../../modules/ppe-permissions/ppe-permissions";
import { Message } from "../../modules/ppe-ui/ppe-ui";
import { businessToday } from "../../modules/ppe-ui/ppe-presentation";
import { usePpeQuery } from "../../modules/ppe-ui/usePpeQuery";
import { PpeQueryState } from "../../modules/ppe-ui/PpeQueryState";
import { IssueFormModal } from "./IssueFormModal";
export function IssuePanel({
  employees,
  items,
  role,
  revision,
  onChanged,
  initialEmployeeId,
  onOpenEmployee,
  onBack,
}: {
  employees: PpeEmployee[];
  items: PpeItem[];
  role: string | null;
  revision: number;
  onChanged: () => void;
  initialEmployeeId?: number;
  onOpenEmployee?: (id: number) => void;
  onBack?: () => void;
}) {
  const [employeeId, setEmployeeId] = useState(
    initialEmployeeId ? String(initialEmployeeId) : "",
  );
  const [on, setOn] = useState(businessToday);
  const [selected, setSelected] = useState<number[]>([]);
  const [form, setForm] = useState<{ rows: PlanRow[] | null } | null>(null);
  const [result, setResult] = useState<IssueResult[] | null>(null);
  const employee = employees.find((item) => String(item.id) === employeeId);
  const backdate = canBackdatePpeIssue(role);
  const issuedAt = backdate ? on : undefined;
  const plan = usePpeQuery(
    `plan:${employeeId}:${issuedAt ?? ""}:${revision}`,
    (signal) => ppeApi.plan(Number(employeeId), issuedAt, signal),
    Boolean(employeeId && (!backdate || on)),
  );
  const changeEmployee = (id: string) => {
    setEmployeeId(id);
    setSelected([]);
    setResult(null);
  };
  const choose = (row: PlanRow, checked: boolean) =>
    setSelected((current) =>
      checked
        ? [...current, row.normItemId]
        : current.filter((id) => id !== row.normItemId),
    );
  const dueItems =
    plan.data?.items.filter((row) => row.available !== null) ?? [];
  const eligible =
    plan.data?.items.filter(
      (row) => row.available && selected.includes(row.normItemId),
    ) ?? [];
  const created = (rows: IssueResult[]) => {
    setResult(rows);
    setSelected([]);
    onChanged();
  };
  const allowed =
    canIssuePpe(role) &&
    Boolean(employee?.isActive) &&
    (!backdate || Boolean(on && on <= businessToday()));
  return (
    <>
      {!employee && !initialEmployeeId && (
        <EmployeeSearch
          employees={employees}
          onSelect={(id) => {
            if (onOpenEmployee) onOpenEmployee(id);
            else changeEmployee(String(id));
          }}
        />
      )}
      {(employee || initialEmployeeId) && (
        <button
          type="button"
          className="ppe-search-back"
          onClick={() => {
            if (onBack) {
              onBack();
              return;
            }
            changeEmployee("");
          }}
        >
          <ArrowLeft size={18} aria-hidden="true" /> Назад
        </button>
      )}
      {initialEmployeeId && !employee && (
        <Message error="Сотрудник не найден." />
      )}
      {employee && (
        <EmployeeIssueCard
          employee={employee}
          allowed={allowed}
          backdate={backdate}
          on={on}
          revision={revision}
          role={role}
          onChanged={onChanged}
          onExtraIssue={() => setForm({ rows: null })}
          onDateChange={(date) => {
            setOn(date);
            setSelected([]);
            setResult(null);
          }}
        />
      )}
      {result && <IssueResultMessage result={result} />}
      <PpeQueryState {...plan} />
      {plan.data && (!plan.data.norm || dueItems.length > 0) && (
        <IssuePlanTable
          plan={plan.data}
          dueItems={dueItems}
          allowed={allowed}
          selected={selected}
          hasSelection={eligible.length > 0}
          onChoose={choose}
          onIssue={() => setForm({ rows: eligible })}
        />
      )}
      {form && employee && (
        <IssueFormModal
          employee={employee}
          items={items}
          regularRows={form.rows}
          issuedAt={issuedAt}
          onClose={() => setForm(null)}
          onCreated={created}
        />
      )}
    </>
  );
}
