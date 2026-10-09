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
import type {
  ChecklistModule,
  ChecklistQuestion,
  ChecklistTemplateDetail,
  ChecklistTemplateModule,
} from "../../shared/api/checklists";

type ChecklistTemplateEditorModalsProps = {
  addQuestionModule: ChecklistTemplateModule | null;
  addQuestionQuestions: ChecklistQuestion[];
  confirm: TemplateEditorConfirmState;
  editMainData: boolean;
  template: ChecklistTemplateDetail | null;
  questions: ChecklistQuestion[];
  isNewTemplate: boolean;
  isCopyTemplate: boolean;
  isSaving: boolean;
  updateMainData: (payload: {
    name: string;
    description?: string | null;
  }) => Promise<boolean>;
  addModuleWithQuestions: (
    moduleId: number,
    questionIds: number[],
    index: number,
  ) => Promise<boolean>;
  addQuestions: (moduleId: number, questionIds: number[]) => Promise<boolean>;
  mainDataError: string | null;
  addModuleTargetIndex: number | null;
  onCloseAddModule: () => void;
  onCloseAddQuestion: () => void;
  onCloseConfirm: () => void;
  onCloseEditMainData: () => void;
  onClosePreview: () => void;
  onConfirmAction: () => Promise<boolean>;

  previewOpen: boolean;
  selectedModule: ChecklistModule | null;
};

export function ChecklistTemplateEditorModals({
  addQuestionModule,
  addQuestionQuestions,
  confirm,
  editMainData,
  template,
  questions,
  isNewTemplate,
  isCopyTemplate,
  isSaving,
  updateMainData,
  addModuleWithQuestions,
  addQuestions,
  mainDataError,
  addModuleTargetIndex,
  onCloseAddModule,
  onCloseAddQuestion,
  onCloseConfirm,
  onCloseEditMainData,
  onClosePreview,
  onConfirmAction,

  previewOpen,
  selectedModule,
}: ChecklistTemplateEditorModalsProps) {
  if (!template) {
    return null;
  }

  return (
    <>
      {editMainData ? (
        <TemplateMainDataModal
          autoFocusName={isNewTemplate}
          initialError={mainDataError}
          isSaving={isSaving}
          onClose={onCloseEditMainData}
          onSubmit={(payload) => {
            void updateMainData(payload).then((isSuccess) => {
              if (isSuccess) {
                onCloseEditMainData();
              }
            });
          }}
          selectNameOnFocus={isCopyTemplate}
          template={template}
        />
      ) : null}

      {selectedModule ? (
        <AddModuleModal
          isSaving={isSaving}
          module={selectedModule}
          onClose={onCloseAddModule}
          onSubmit={(questionIds) => {
            void addModuleWithQuestions(
              selectedModule.id,
              questionIds,
              addModuleTargetIndex ?? template.modules.length,
            ).then((isSuccess) => {
              if (isSuccess) {
                onCloseAddModule();
              }
            });
          }}
          questions={questions.filter(
            (question) => question.checklistModuleId === selectedModule.id,
          )}
        />
      ) : null}

      {addQuestionModule ? (
        <AddQuestionModal
          isSaving={isSaving}
          module={addQuestionModule}
          onClose={onCloseAddQuestion}
          onSubmit={(questionIds) => {
            void addQuestions(addQuestionModule.id, questionIds).then(
              (isSuccess) => {
                if (isSuccess) {
                  onCloseAddQuestion();
                }
              },
            );
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
          isLoading={isSaving}
          loadingLabel="Выполняется..."
          onCancel={onCloseConfirm}
          onConfirm={() => {
            void onConfirmAction().then((isSuccess) => {
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
