import { useCallback } from "react";
import { Notice } from "../../shared/ui/Notice";
import { canManageChecklists } from "../../shared/lib/roles";
import "../ChecklistAdminPage/ChecklistAdminPage.css";
import { AvailableModulesPanel } from "./AvailableModulesPanel";
import "./ChecklistTemplateEditorPage.css";
import { TemplateDragOverlay } from "./TemplateDragOverlay";
import { ChecklistTemplateEditorHeader } from "./ChecklistTemplateEditorHeader";
import { ChecklistTemplateEditorModals } from "./ChecklistTemplateEditorModals";
import { TemplateModuleSection } from "./TemplateModuleSection";
import { TemplateStructureContextMenu } from "./TemplateStructureContextMenu";
import {
  getModuleDropPosition,
  getQuestionDropPosition,
  isCatalogModuleDragOver,
} from "./template-drop-position";
import {
  getAddQuestionModule,
  getAvailableQuestions,
  getSelectedModule,
} from "./template-editor-selectors";
import { useChecklistTemplateEditor } from "./useChecklistTemplateEditor";
import { useChecklistTemplateEditorPageState } from "./useChecklistTemplateEditorPageState";
import { useTemplateEditorExitGuard } from "./useTemplateEditorExitGuard";
import { useTemplateStructureInteractions } from "./useTemplateStructureInteractions";

type ChecklistTemplateEditorPageProps = {
  copyFromTemplateId?: number | null;
  templateId: number | null;
  userRole: string | null;
};

export function ChecklistTemplateEditorPage({
  copyFromTemplateId = null,
  templateId,
  userRole,
}: ChecklistTemplateEditorPageProps) {
  const isAdmin = canManageChecklists(userRole);
  const editor = useChecklistTemplateEditor({
    copyFromTemplateId,
    isAdmin,
    templateId,
  });
  const template = editor.template;
  const isReadOnly = !template || !editor.isEditable;
  const pageState = useChecklistTemplateEditorPageState({
    copyFromTemplateId,
    isNewTemplate: editor.isNewTemplate,
    isTemplateLoading: editor.isLoading,
    templateId,
    templateReady: Boolean(template),
  });
  const {
    addModuleId,
    addModuleTargetIndex,
    addQuestionModuleId,
    confirm,
    editMainData,
    mainDataError,
    previewOpen,
    closeAddModuleModal,
    closeAddQuestionModal,
    closeMainDataModal,
    closePreview,
    openAddModuleModal: openAddModuleState,
    openAddQuestionModal,
    openMainDataModal,
    openPreview,
    setConfirm,
  } = pageState;

  const openAddModuleModal = useCallback(
    (moduleId: number, targetIndex?: number) => {
      if (!template) {
        return;
      }

      if (
        template.modules.some((module) => module.checklistModuleId === moduleId)
      ) {
        return;
      }

      openAddModuleState(
        moduleId,
        targetIndex ?? getBaseOrderInsertionIndex(editor.modules, template, moduleId),
      );
    },
    [editor.modules, openAddModuleState, template],
  );

  const structureInteractions = useTemplateStructureInteractions({
    editor,
    isReadOnly,
    onDropCatalogModule: openAddModuleModal,
    onOpenAddQuestions: openAddQuestionModal,
    resetKey: `${templateId ?? "new"}:${copyFromTemplateId ?? "none"}:${template?.id ?? "loading"}`,
    template,
  });
  const {
    contextMenu,
    dragAndDrop,
    focusedTarget,
    handleContextAddQuestions,
    handleTargetKeyDown,
    setFocusedTarget,
  } = structureInteractions;

  const openExitConfirm = useCallback(() => {
    setConfirm("exit");
  }, [setConfirm]);

  const { pendingExitHref, requestExit } = useTemplateEditorExitGuard({
    exitEditor: editor.exitEditor,
    onRequestConfirmExit: openExitConfirm,
    shouldConfirmExit: editor.shouldConfirmExit,
  });

  const selectedModule = getSelectedModule(editor.modules, addModuleId);
  const addQuestionModule = getAddQuestionModule(template, addQuestionModuleId);

  const handleSave = () => {
    if (!template?.name.trim()) {
      openMainDataModal("Укажите название шаблона.");
      return;
    }

    void editor.save();
  };

  if (!isAdmin) {
    return (
      <section className="checklist-editor-page">
        <Notice tone="error">Недостаточно прав для управления чек-листами.</Notice>
      </section>
    );
  }

  if (editor.isLoading) {
    return (
      <section className="checklist-editor-page">
        <p className="admin-state">Загрузка...</p>
      </section>
    );
  }

  if (!template) {
    return (
      <section className="checklist-editor-page">
        {editor.error ? (
          <Notice tone="error">{editor.error}</Notice>
        ) : (
          <Notice tone="error">Шаблон не найден.</Notice>
        )}
      </section>
    );
  }

  return (
    <section className="checklist-editor-page">
      <ChecklistTemplateEditorHeader
        isReadOnly={isReadOnly}
        onBack={() => requestExit()}
        onEditMainData={() => openMainDataModal()}
        onPreview={openPreview}
        onSave={handleSave}
        template={template}
      />

      {editor.error ? <Notice tone="error">{editor.error}</Notice> : null}
      {editor.message ? <Notice tone="success">{editor.message}</Notice> : null}

      <div className="checklist-editor-layout">
        <AvailableModulesPanel
          dragProps={dragAndDrop.getDragProps}
          dragItem={dragAndDrop.dragItem}
          dragOver={dragAndDrop.dragOver}
          isReadOnly={isReadOnly}
          isSaving={editor.isSaving}
          modules={editor.modules}
          onAddModule={openAddModuleModal}
          questions={editor.questions}
          template={template}
        />

        <main
          className={`checklist-editor-panel checklist-editor-structure-panel${focusedTarget ? " has-focused-structure-target" : ""}${isCatalogModuleDragOver(dragAndDrop.dragItem, dragAndDrop.dragOver) ? " catalog-drop-active" : ""}`}
          data-template-modules-count={template.modules.length}
          data-template-structure-drop-zone="true"
        >
          <h2>Структура шаблона</h2>
          {template.modules.length === 0 ? (
            <p className="admin-state">
              В шаблоне пока нет модулей. Выберите модуль в левой панели и
              добавьте нужные вопросы.
            </p>
          ) : null}
          <div className="checklist-editor-structure">
            {template.modules.map((module, moduleIndex) => (
              <TemplateModuleSection
                dragProps={dragAndDrop.getDragProps}
                dragItem={dragAndDrop.dragItem}
                dropPosition={getModuleDropPosition(
                  dragAndDrop.dragOver,
                  moduleIndex,
                )}
                getContextTargetProps={contextMenu.getTargetProps}
                isReadOnly={isReadOnly}
                isSaving={editor.isSaving}
                key={module.id}
                module={module}
                moduleIndex={moduleIndex}
                onFocusTarget={setFocusedTarget}
                onKeyDownTarget={handleTargetKeyDown}
                onToggleRequired={(questionId, isRequired) =>
                  void editor.toggleRequired(questionId, isRequired)
                }
                questionDropPosition={(questionId) =>
                  getQuestionDropPosition(
                    dragAndDrop.dragOver,
                    module.id,
                    module.questions.findIndex(
                      (question) => question.id === questionId,
                    ),
                  )
                }
              />
            ))}
          </div>
        </main>
      </div>

      <TemplateStructureContextMenu
        menu={contextMenu.menu}
        onAddQuestions={handleContextAddQuestions}
        onDelete={contextMenu.requestMenuDelete}
      />
      <TemplateDragOverlay
        preview={dragAndDrop.dragPreview}
        setOverlayRef={dragAndDrop.setOverlayRef}
      />

      <ChecklistTemplateEditorModals
        addModuleTargetIndex={addModuleTargetIndex}
        addQuestionModule={addQuestionModule}
        addQuestionQuestions={
          addQuestionModule
            ? getAvailableQuestions(editor.questions, addQuestionModule)
            : []
        }
        confirm={confirm}
        editMainData={editMainData}
        editor={editor}
        mainDataError={mainDataError}
        onCloseAddModule={closeAddModuleModal}
        onCloseAddQuestion={closeAddQuestionModal}
        onCloseConfirm={() => setConfirm(null)}
        onCloseEditMainData={closeMainDataModal}
        onClosePreview={closePreview}
        onConfirmAction={runConfirmAction}
        pendingExitHref={pendingExitHref}
        previewOpen={previewOpen}
        selectedModule={selectedModule}
      />
    </section>
  );
}

function getBaseOrderInsertionIndex(
  modules: ReturnType<typeof useChecklistTemplateEditor>["modules"],
  template: NonNullable<ReturnType<typeof useChecklistTemplateEditor>["template"]>,
  moduleId: number,
) {
  const sourceModule = modules.find((module) => module.id === moduleId);

  if (!sourceModule) {
    return template.modules.length;
  }

  const orderByModuleId = new Map(
    modules.map((module) => [module.id, module.sortOrder] as const),
  );

  return template.modules.filter(
    (templateModule) =>
      (orderByModuleId.get(templateModule.checklistModuleId) ??
        Number.MAX_SAFE_INTEGER) < sourceModule.sortOrder,
  ).length;
}

async function runConfirmAction(
  editor: ReturnType<typeof useChecklistTemplateEditor>,
  pendingExitHref: string,
) {
  return editor.exitEditor(pendingExitHref);
}
