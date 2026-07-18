import { Eye, Pencil, Save } from "lucide-react";
import type { ChecklistTemplateDetail } from "../../shared/api/checklists";

type ChecklistTemplateEditorHeaderProps = {
  isReadOnly: boolean;
  onBack: () => void;
  onEditMainData: () => void;
  onPreview: () => void;
  onSave: () => void;
  template: ChecklistTemplateDetail;
};

export function ChecklistTemplateEditorHeader({
  isReadOnly,
  onBack,
  onEditMainData,
  onPreview,
  onSave,
  template,
}: ChecklistTemplateEditorHeaderProps) {
  return (
    <header className="checklist-editor-header">
      <button className="checklist-editor-back" onClick={onBack} type="button">
        ← Назад
      </button>
      <div className="checklist-editor-title-row">
        <div>
          <h1>{template.name || "Новый шаблон"}</h1>
        </div>
        <div className="checklist-editor-actions">
          {!isReadOnly ? (
            <button
              className="admin-secondary-button"
              onClick={onEditMainData}
              type="button"
            >
              <Pencil size={17} />
              Основные данные
            </button>
          ) : null}
          <button
            className="admin-secondary-button"
            onClick={onPreview}
            type="button"
          >
            <Eye size={17} />
            Предпросмотр
          </button>
          {!isReadOnly ? (
            <button
              className="admin-primary-button"
              onClick={onSave}
              type="button"
            >
              <Save size={17} />
              Сохранить
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
