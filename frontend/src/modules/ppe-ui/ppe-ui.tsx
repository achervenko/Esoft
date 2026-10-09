import { AdminFormField } from "../../shared/ui/AdminFormField";
import type { ReactNode } from "react";
import { Notice } from "../../shared/ui/Notice";
import "./PpeForm.css";
export function Message({
  error,
  children,
}: {
  error?: string | null;
  children?: ReactNode;
}) {
  return error ? (
    <Notice tone="error">{error}</Notice>
  ) : children ? (
    <Notice tone="success">{children}</Notice>
  ) : null;
}
export function Field({
  label,
  children,
  hideLabel = false,
}: {
  label: string;
  children: ReactNode;
  hideLabel?: boolean;
}) {
  return (
    <AdminFormField label={label} hideLabel={hideLabel} className="ppe-field">
      {children}
    </AdminFormField>
  );
}
