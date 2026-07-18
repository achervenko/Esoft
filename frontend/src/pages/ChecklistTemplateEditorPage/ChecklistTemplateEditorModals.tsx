import { ConfirmDialog } from "../../shared/ui/ConfirmDialog";
import { AddModuleModal } from "./AddModuleModal";
import { AddQuestionModal } from "./AddQuestionModal";
import { PreviewModal } from "./PreviewModal";
import { TemplateMainDataModal } from "./TemplateMainDataModal";
import {
  getTemplateConfirmDescription,
  getTemplateConfirmLabel,
  getTemplateConfirmTitle,
  type TemplateEditorConfirmState,
} from "./checklist-template-editor.utils";
import type { useChecklistTemplateEditor } from "./useChecklistTemplateEditor";

type EditorState = ReturnType<typeof useChecklistTemplateEditor>;

type ChecklistTemplateEditorModalsProps = {
  addQuestionModule: NonNullable<EditorState["template"]>["modules"][number] | null;
  addQuestionQuestions: EditorState["questions"];
  confirm: TemplateEditorConfirmState;
  editMainData: boolean;
  editor: EditorState;
  mainDataError: string | null;
  addModuleTargetIndex: number | null;
  onCloseAddModule: () => void;
  onCloseAddQuestion: () => void;
  onCloseConfirm: () => void;
  onCloseEditMainData: () => void;
  onClosePreview: () => void;
  onConfirmAction: (
    editor: EditorState,
    pendingExitHref: string,
  ) => Promise<boolean>;
  pendingExitHref: string;
  previewOpen: boolean;
  selectedModule: EditorState["modules"][number] | null;
};

export function ChecklistTemplateEditorModals({
  addQuestionModule,
  addQuestionQuestions,
  confirm,
  editMainData,
  editor,
  mainDataError,
  addModuleTargetIndex,
  onCloseAddModule,
  onCloseAddQuestion,
  onCloseConfirm,
  onCloseEditMainData,
  onClosePreview,
  onConfirmAction,
  pendingExitHref,
  previewOpen,
  selectedModule,
}: ChecklistTemplateEditorModalsProps) {
  const template = editor.template;

  if (!template) {
    return null;
  }

  return (
    <>
      {editMainData ? (
        <TemplateMainDataModal
          autoFocusName={editor.isNewTemplate}
          initialError={mainDataError}
          isSaving={editor.isSaving}
          onClose={onCloseEditMainData}
          onSubmit={(payload) => {
            void editor.updateMainData(payload).then((isSuccess) => {
              if (isSuccess) {
                onCloseEditMainData();
              }
            });
          }}
          selectNameOnFocus={editor.isCopyTemplate}
          template={template}
        />
      ) : null}

      {selectedModule ? (
        <AddModuleModal
          isSaving={editor.isSaving}
          module={selectedModule}
          onClose={onCloseAddModule}
          onSubmit={(questionIds) => {
            void editor
              .addModuleWithQuestions(
                selectedModule.id,
                questionIds,
                addModuleTargetIndex ?? template.modules.length,
              )
              .then((isSuccess) => {
                if (isSuccess) {
                  onCloseAddModule();
                }
              });
          }}
          questions={editor.questions.filter(
            (question) => question.checklistModuleId === selectedModule.id,
          )}
        />
      ) : null}

      {addQuestionModule ? (
        <AddQuestionModal
          isSaving={editor.isSaving}
          module={addQuestionModule}
          onClose={onCloseAddQuestion}
          onSubmit={(questionIds) => {
            void editor
              .addQuestions(addQuestionModule.id, questionIds)
              .then((isSuccess) => {
                if (isSuccess) {
                  onCloseAddQuestion();
                }
              });
          }}
          questions={addQuestionQuestions}
        />
      ) : null}

      {previewOpen ? (
        <PreviewModal onClose={onClosePreview} template={template} />
      ) : null}

      {confirm ? (
        <ConfirmDialog
          cancelLabel="Остаться"
          confirmLabel={getTemplateConfirmLabel()}
          description={getTemplateConfirmDescription()}
          isLoading={editor.isSaving}
          loadingLabel="Выполняется..."
          onCancel={onCloseConfirm}
          onConfirm={() => {
            void onConfirmAction(editor, pendingExitHref).then((isSuccess) => {
              if (isSuccess) {
                onCloseConfirm();
              }
            });
          }}
          title={getTemplateConfirmTitle()}
          variant="danger"
        />
      ) : null}
    </>
  );
}
