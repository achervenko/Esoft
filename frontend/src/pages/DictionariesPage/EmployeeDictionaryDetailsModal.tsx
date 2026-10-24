import type { ReactNode } from "react";
import type { EmployeeSizes } from "../../shared/api/ppe";
import { AdminModal } from "../../shared/ui/AdminModal";
import { employeeSizeLabels } from "../../modules/ppe-ui/employee-sizes-model";

type EmployeeDictionaryDetailsModalProps = {
  title: string;
  isSaving: boolean;
  onClose: () => void;
  details: ReactNode;
  actions: ReactNode;
  showSizes: boolean;
  sizes: EmployeeSizes | null | undefined;
};

export function EmployeeDictionaryDetailsModal({
  title,
  isSaving,
  onClose,
  details,
  actions,
  showSizes,
  sizes,
}: EmployeeDictionaryDetailsModalProps) {
  return (
    <AdminModal title={title} onClose={onClose}
      isCloseDisabled={isSaving} className="dictionary-employee-modal">
      <div className="admin-form">
        <dl className="dictionary-employee-details">
          {details}
          {showSizes && (Object.keys(employeeSizeLabels) as (keyof EmployeeSizes)[]).map((key) => (
            <div key={key}>
              <dt>{employeeSizeLabels[key]}</dt>
              <dd>{sizes === undefined ? "Не загружен" : sizes?.[key] ?? "Не указан"}</dd>
            </div>
          ))}
        </dl>
        {actions}
      </div>
    </AdminModal>
  );
}
