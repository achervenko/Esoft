import { ChecklistTemplateArchiveDialog } from "../../modules/checklists/ChecklistTemplateArchiveDialog";
import { ChecklistAdminConfirmDialog } from "./ChecklistAdminConfirmDialog";
import { ModuleFormModal } from "./ModuleFormModal";
import { QuestionFormModal } from "./QuestionFormModal";
import type {
  ChecklistAdminConfirmState,
  ChecklistAdminFormState,
} from "./checklist-admin.types";
import type { useChecklistAdminActions } from "./useChecklistAdminActions";
import type { useChecklistCatalog } from "./useChecklistCatalog";

type ChecklistAdminModalsProps = {
  actions: ReturnType<typeof useChecklistAdminActions>;
  catalogState: ReturnType<typeof useChecklistCatalog>;
  confirm: ChecklistAdminConfirmState;
  form: ChecklistAdminFormState;
  setConfirm: (confirm: ChecklistAdminConfirmState) => void;
  setForm: (form: ChecklistAdminFormState) => void;
};

export function ChecklistAdminModals({
  actions,
  catalogState,
  confirm,
  form,
  setConfirm,
  setForm,
}: ChecklistAdminModalsProps) {
  return (
    <>
      {form?.kind === "module" ? (
        <ModuleFormModal
          isSaving={actions.isSaving}
          item={form.item}
          onClose={() => setForm(null)}
          onSubmit={(payload) =>
            void actions.saveModule(form.item, payload, () => setForm(null))
          }
        />
      ) : null}

      {form?.kind === "question" ? (
        <QuestionFormModal
          defaultModuleId={form.defaultModuleId}
          isSaving={actions.isSaving}
          item={form.item}
          modules={catalogState.activeModules}
          onClose={() => setForm(null)}
          onSubmit={(payload) =>
            void actions.saveQuestion(form.item, payload, () => setForm(null))
          }
        />
      ) : null}

      {confirm?.kind === "archive-template" ? (
        <ChecklistTemplateArchiveDialog
          onCancel={() => setConfirm(null)}
          onSuccess={(response) =>
            void actions.handleTemplateArchived(response, () =>
              setConfirm(null),
            )
          }
          template={confirm.template}
        />
      ) : null}

      {confirm && confirm.kind !== "archive-template" ? (
        <ChecklistAdminConfirmDialog
          confirm={confirm}
          isSaving={actions.isSaving}
          onCancel={() => setConfirm(null)}
          onConfirm={() =>
            void actions.runConfirmAction(confirm, () => setConfirm(null))
          }
        />
      ) : null}
    </>
  );
}
