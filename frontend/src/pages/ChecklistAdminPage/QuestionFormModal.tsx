import { useRef, useState } from "react";
import {
  type ChecklistAnswerType,
  type ChecklistModule,
  type ChecklistQuestion,
} from "../../shared/api/checklists";
import {
  AdminFormActions,
  AdminTextareaField,
} from "../../shared/ui/AdminFormControls";
import { AdminModal } from "../../shared/ui/AdminModal";
import { SelectDropdown } from "../../shared/ui/SelectDropdown";
import { answerTypeOptions } from "./checklist-admin.constants";

type QuestionFormModalProps = {
  defaultModuleId: number | null;
  isSaving: boolean;
  item: ChecklistQuestion | null;
  modules: ChecklistModule[];
  onClose: () => void;
  onSubmit: (payload: {
    answerType: ChecklistAnswerType;
    checklistModuleId: number | null;
    questionText: string;
  }) => void;
};

export function QuestionFormModal({
  defaultModuleId,
  isSaving,
  item,
  modules,
  onClose,
  onSubmit,
}: QuestionFormModalProps) {
  const [moduleId, setModuleId] = useState(
    item
      ? item.checklistModuleId === null
        ? ""
        : String(item.checklistModuleId)
      : defaultModuleId === null
        ? ""
        : String(defaultModuleId),
  );
  const [answerType, setAnswerType] = useState<ChecklistAnswerType>(
    item?.answerType ?? "BOOLEAN",
  );
  const [questionText, setQuestionText] = useState(item?.questionText ?? "");
  const [error, setError] = useState<string | null>(null);
  const questionTextRef = useRef<HTMLTextAreaElement | null>(null);
  const moduleOptions = [
    { label: "Без модуля", value: "" },
    ...modules.map((module) => ({
      label: module.name,
      value: String(module.id),
    })),
  ];

  if (
    item &&
    item.module &&
    !moduleOptions.some((option) => option.value === String(item.module?.id))
  ) {
    moduleOptions.push({
      label: `${item.module.name} (неактивен)`,
      value: String(item.module.id),
    });
  }

  return (
    <AdminModal
      onClose={onClose}
      title={item ? "Редактировать вопрос" : "Создать вопрос"}
    >
      <form
        className="admin-form"
        onSubmit={(event) => {
          event.preventDefault();
          const parsedModuleId = moduleId ? Number(moduleId) : null;
          const trimmedText = questionText.trim();

          if (!trimmedText) {
            setError("Укажите текст вопроса.");
            questionTextRef.current?.focus();
            return;
          }

          if (
            parsedModuleId !== null &&
            (!Number.isInteger(parsedModuleId) || parsedModuleId <= 0)
          ) {
            setError("Выберите корректный модуль.");
            return;
          }

          onSubmit({
            answerType,
            checklistModuleId: parsedModuleId,
            questionText: trimmedText,
          });
        }}
      >
        <SelectDropdown
          disabled={isSaving}
          label="Модуль"
          onChange={setModuleId}
          options={moduleOptions}
          value={moduleId}
        />
        <AdminTextareaField
          autoFocus={!item}
          disabled={isSaving}
          label="Текст вопроса"
          onChange={(value) => {
            setQuestionText(value);
            setError(null);
          }}
          required
          textareaRef={questionTextRef}
          value={questionText}
        />
        <SelectDropdown
          disabled={isSaving}
          label="Тип ответа"
          onChange={(value) => setAnswerType(value as ChecklistAnswerType)}
          options={answerTypeOptions}
          required
          value={answerType}
        />
        {error ? <p className="admin-form-error">{error}</p> : null}
        <AdminFormActions isSaving={isSaving} onClose={onClose} />
      </form>
    </AdminModal>
  );
}
