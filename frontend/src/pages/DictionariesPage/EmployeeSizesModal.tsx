import { ClothingSizeGrid } from "../../modules/ppe-ui/ClothingSizeGrid";
import { normalizePpeSizeText } from "../../shared/lib/ppe-size-text";
import {
  employeeSizeLabels,
  changedEmployeeSizes,
} from "../../modules/ppe-ui/employee-sizes-model";
import { useState, useEffect } from "react";
import {
  ppeApi,
  type EmployeeSizes,
  type PpeEmployee,
} from "../../shared/api/ppe";
import { GuardedAdminModal } from "../../shared/ui/GuardedAdminModal";
import { Field, Message } from "../../modules/ppe-ui/ppe-ui";
import { employeeName, ppeError } from "../../modules/ppe-ui/ppe-presentation";
import { usePpeQuery } from "../../modules/ppe-ui/usePpeQuery";
import { PpeQueryState } from "../../modules/ppe-ui/PpeQueryState";
import "../../shared/ui/AdminPage.css";
import "../../modules/ppe-ui/PpeForm.css";

export function EmployeeSizeSummary({ employee }: { employee: EmployeeSizes }) {
  return (
    <div className="ppe-size-summary">
      {Object.entries(employeeSizeLabels).map(([key, label]) => (
        <span key={key}>
          {label}:{" "}
          <strong>{employee[key as keyof EmployeeSizes] ?? "—"}</strong>
        </span>
      ))}
    </div>
  );
}

export function EmployeeSizesModal({
  id,
  onClose,
  onChanged,
}: {
  id: number;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const employee = usePpeQuery(`employee:${id}`, (signal) =>
    ppeApi.employee(id, signal),
  );
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  return (
    <GuardedAdminModal
      hasChanges={hasChanges}
      title="Размеры сотрудника"
      className="ppe-clothing-modal"
      onClose={onClose}
      isCloseDisabled={saving}
    >
      <div className="ppe-form">
        <PpeQueryState {...employee} />
        {employee.data && (
          <EmployeeSizesForm
            employee={employee.data}
            onClose={onClose}
            onChanged={onChanged}
            onSavingChange={setSaving}
            onChangesChange={setHasChanges}
          />
        )}
      </div>
    </GuardedAdminModal>
  );
}
function EmployeeSizesForm({
  employee,
  onClose,
  onChanged,
  onSavingChange,
  onChangesChange,
}: {
  employee: PpeEmployee;
  onClose: () => void;
  onChanged?: () => void;
  onSavingChange: (saving: boolean) => void;
  onChangesChange: (changed: boolean) => void;
}) {
  const [draft, setDraft] = useState<Record<keyof EmployeeSizes, string>>({
    clothingSize: employee.clothingSize ?? "",
    clothingHeight: employee.clothingHeight ?? "",
    shoeSize: employee.shoeSize?.toString() ?? "",
    gloveSize: employee.gloveSize ?? "",
    headwearSize: employee.headwearSize ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changed = changedEmployeeSizes(employee, draft);
  const hasChanges = Object.keys(changed).length > 0;
  useEffect(() => {
    onChangesChange(hasChanges);
  }, [hasChanges, onChangesChange]);
  return (
    <form
      className="ppe-form ppe-employee-sizes-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!Object.keys(changed).length) return;
        setSaving(true);
        onSavingChange(true);
        setError(null);
        void ppeApi
          .employeeSizes(employee.id, changed)
          .then(() => {
            onChanged?.();
            onClose();
          })
          .catch((err) => setError(ppeError(err)))
          .finally(() => {
            setSaving(false);
            onSavingChange(false);
          });
      }}
    >
      <div className="ppe-employee-sizes-heading">
        <strong>{employeeName(employee)}</strong>
        <p>{employee.position}</p>
      </div>
      <fieldset className="ppe-form" disabled={saving || !employee.isActive}>
        <legend>Размер одежды и ростовка</legend>
        <ClothingSizeGrid
          selectionMode="single"
          values={draft.clothingSize && draft.clothingHeight ? [{ value: draft.clothingSize, heightValue: draft.clothingHeight }] : []}
          disabled={saving || !employee.isActive}
          onChange={(values) => setDraft((current) => ({
            ...current,
            clothingSize: values[0]?.value ?? "",
            clothingHeight: values[0]?.heightValue ?? "",
          }))}
        />
      </fieldset>
      {(
        Object.entries(employeeSizeLabels) as [keyof EmployeeSizes, string][]
      ).filter(([key]) => key !== "clothingSize" && key !== "clothingHeight").map(([key, label]) => (
        <Field key={key} label={label}>
          <input
            autoFocus={key === "clothingSize" && employee.isActive}
            type={key === "shoeSize" ? "number" : "text"}
            min={key === "shoeSize" ? 15 : undefined}
            max={key === "shoeSize" ? 60 : undefined}
            step={key === "shoeSize" ? "0.1" : undefined}
            maxLength={key === "shoeSize" ? undefined : 20}
            value={draft[key]}
            disabled={saving || !employee.isActive}
            onChange={(e) =>
              setDraft((current) => ({
                ...current,
                [key]:
                  key === "shoeSize"
                    ? e.target.value
                    : normalizePpeSizeText(e.target.value),
              }))
            }
          />
        </Field>
      ))}
      {!employee.isActive && (
        <Message error="Размеры отключённого сотрудника изменить нельзя." />
      )}
      <Message error={error} />
      <div className="ppe-employee-sizes-actions">
      <button
        className="admin-primary-button"
        disabled={saving || !employee.isActive || !Object.keys(changed).length}
      >
        {saving ? "Сохранение..." : "Сохранить размеры"}
      </button>
      </div>
    </form>
  );
}
