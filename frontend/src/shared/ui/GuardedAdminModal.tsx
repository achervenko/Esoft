import type { ComponentProps, ReactNode } from "react";
import { AdminModal } from "./AdminModal";
import { UnsavedChangesGuard } from "./UnsavedChangesGuard";

type Props = Omit<ComponentProps<typeof AdminModal>, "children"> & {
  hasChanges: boolean;
  children:
    ReactNode | ((requestLeave: (action: () => void) => void) => ReactNode);
};
/** Extends the ordinary modal without duplicating its focus or close handling. */
export function GuardedAdminModal({
  hasChanges,
  children,
  onClose,
  ...props
}: Props) {
  return (
    <UnsavedChangesGuard
      hasChanges={hasChanges}
      isBlocked={props.isCloseDisabled}
    >
      {(requestLeave) => (
        <AdminModal {...props} onClose={() => requestLeave(onClose)}>
          {typeof children === "function" ? children(requestLeave) : children}
        </AdminModal>
      )}
    </UnsavedChangesGuard>
  );
}
