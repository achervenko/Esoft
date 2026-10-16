import { ChevronRight } from "lucide-react";
import type { PpeEmployee, EmployeeSizes } from "../../shared/api/ppe";
import { Field, Message } from "../../modules/ppe-ui/ppe-ui";
import { employeeName, businessToday } from "../../modules/ppe-ui/ppe-presentation";
import { employeeSizeLabels } from "../../modules/ppe-ui/employee-sizes-model";
import { EmployeeNorms } from "./EmployeeNorms";
import { EmployeeIssueHistory } from "./EmployeeIssueHistory";

type EmployeeIssueCardProps = {
  employee: PpeEmployee;
  allowed: boolean;
  backdate: boolean;
  on: string;
  revision: number;
  role: string | null;
  onChanged: () => void;
  onExtraIssue: () => void;
  onDateChange: (date: string) => void;
};
export function EmployeeIssueCard({
  employee,
  allowed,
  backdate,
  on,
  revision,
  role,
  onChanged,
  onExtraIssue,
  onDateChange,
}: EmployeeIssueCardProps) {
  return (
    <article className="ppe-employee-card">
      <header className="ppe-employee-header">
        <div>
          <h2>{employeeName(employee)}</h2>
          <p>{employee.position}</p>
        </div>
        {allowed && (
          <button className="admin-primary-button" onClick={onExtraIssue}>
            Дополнительная выдача
          </button>
        )}
      </header>
      {backdate && (
        <Field label="Дата выдачи">
          <input
            type="date"
            required
            max={businessToday()}
            value={on}
            onChange={(event) => {
              onDateChange(event.target.value);
            }}
          />
        </Field>
      )}
      <details
        className="ppe-employee-section ppe-employee-sizes"
        key={`sizes:${employee.id}`}
      >
        <summary>
          <ChevronRight size={16} aria-hidden="true" />
          Размеры сотрудника
        </summary>
        <dl className="ppe-employee-grid">
          {Object.entries(employeeSizeLabels).map(([key, label]) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd>{employee.ppeSizes?.[key as keyof EmployeeSizes] ?? "—"}</dd>
            </div>
          ))}
        </dl>
      </details>
      <EmployeeNorms
        key={`norms:${employee.positionId}`}
        positionId={employee.positionId}
        revision={revision}
      />
      <EmployeeIssueHistory
        employeeId={employee.id}
        role={role}
        revision={revision}
        onChanged={onChanged}
      />
      {!employee.isActive && (
        <Message error="Сотрудник отключён. Новые выдачи недоступны." />
      )}
    </article>
  );
}
