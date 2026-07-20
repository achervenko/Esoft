import { useEffect, useId, useState } from "react";
import { ApiRequestError } from "../../shared/api/api-error";
import {
  archiveChecklistTemplate,
  getChecklistAdminErrorMessage,
  getChecklistTemplate,
  type ChecklistTemplateArchiveResponse,
  type ChecklistTemplateDetail,
  type ChecklistTemplateDetailResponse,
  type ChecklistTemplateUsage,
} from "../../shared/api/checklists";
import { ConfirmDialog } from "../../shared/ui/ConfirmDialog";
import "./ChecklistTemplateArchiveDialog.css";

const ARCHIVE_REASON_MAX_LENGTH = 500;
const VISIBLE_USAGE_LIMIT = 10;

type ChecklistTemplateArchiveTarget = Pick<
  ChecklistTemplateDetail,
  "id" | "name" | "version"
>;

type ChecklistTemplateArchiveDialogProps = {
  initialUsage?: ChecklistTemplateUsage | null;
  onCancel: () => void;
  onSuccess: (
    response: ChecklistTemplateArchiveResponse,
  ) => void | Promise<void>;
  onTemplateReload?: (
    response: ChecklistTemplateDetailResponse,
  ) => void | Promise<void>;
  template: ChecklistTemplateArchiveTarget;
};

export function ChecklistTemplateArchiveDialog({
  initialUsage,
  onCancel,
  onSuccess,
  onTemplateReload,
  template,
}: ChecklistTemplateArchiveDialogProps) {
  const reasonId = useId();
  const hasInitialUsage = initialUsage !== undefined && initialUsage !== null;
  const [currentTemplate, setCurrentTemplate] = useState(template);
  const [usage, setUsage] = useState<ChecklistTemplateUsage | null>(
    initialUsage ?? null,
  );
  const [isUsageLoading, setIsUsageLoading] = useState(!hasInitialUsage);
  const [isArchiving, setIsArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [isReasonTouched, setIsReasonTouched] = useState(false);
  const [showAllUsage, setShowAllUsage] = useState(false);

  useEffect(() => {
    setCurrentTemplate(template);
    setUsage(initialUsage ?? null);
    setIsUsageLoading(!hasInitialUsage);
    setError(null);
    setReason("");
    setIsReasonTouched(false);
    setShowAllUsage(false);
  }, [hasInitialUsage, initialUsage, template]);

  useEffect(() => {
    if (hasInitialUsage) {
      return;
    }

    let isCancelled = false;

    const loadUsage = async () => {
      setIsUsageLoading(true);
      setError(null);

      try {
        const response = await getChecklistTemplate(template.id);

        if (isCancelled) {
          return;
        }

        setCurrentTemplate(response.template);
        setUsage(response.usage);
        await onTemplateReload?.(response);
      } catch (requestError) {
        if (!isCancelled) {
          setError(getChecklistAdminErrorMessage(requestError));
        }
      } finally {
        if (!isCancelled) {
          setIsUsageLoading(false);
        }
      }
    };

    void loadUsage();

    return () => {
      isCancelled = true;
    };
  }, [hasInitialUsage, onTemplateReload, template.id]);

  const trimmedReason = reason.trim();
  const reasonError =
    isReasonTouched && !trimmedReason ? "Укажите причину удаления." : null;
  const isReasonTooLong = reason.length > ARCHIVE_REASON_MAX_LENGTH;
  const isUsageUnavailable = usage === null;
  const maintenanceSettings = usage?.maintenanceSettings ?? [];
  const visibleSettings = showAllUsage
    ? maintenanceSettings
    : maintenanceSettings.slice(0, VISIBLE_USAGE_LIMIT);
  const hasMaintenanceSettings = maintenanceSettings.length > 0;

  const archive = async () => {
    setIsReasonTouched(true);

    if (
      !trimmedReason ||
      isReasonTooLong ||
      isUsageLoading ||
      isUsageUnavailable ||
      isArchiving
    ) {
      return;
    }

    setIsArchiving(true);
    setError(null);

    try {
      const response = await archiveChecklistTemplate(
        currentTemplate.id,
        currentTemplate.version,
        trimmedReason,
      );

      await onSuccess(response);
    } catch (requestError) {
      if (
        requestError instanceof ApiRequestError &&
        requestError.code === "CHECKLIST_TEMPLATE_VERSION_CONFLICT"
      ) {
        setError(
          "Шаблон был изменён другим пользователем. Данные будут обновлены.",
        );
        setIsUsageLoading(true);

        try {
          const response = await getChecklistTemplate(currentTemplate.id);
          setCurrentTemplate(response.template);
          setUsage(response.usage);
          await onTemplateReload?.(response);
        } catch (reloadError) {
          setUsage(null);
          setError(getChecklistAdminErrorMessage(reloadError));
        } finally {
          setIsUsageLoading(false);
        }
      } else {
        setError(getChecklistAdminErrorMessage(requestError));
      }
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <ConfirmDialog
      cancelLabel="Отмена"
      confirmLabel={hasMaintenanceSettings ? "Удалить и отвязать" : "Удалить"}
      description={
        hasMaintenanceSettings
          ? `Шаблон используется в настройках обслуживания: ${maintenanceSettings.length}. При удалении эти привязки будут удалены.`
          : `Удалить шаблон «${currentTemplate.name}»? Новые события больше не смогут использовать его.`
      }
      error={error}
      isConfirmDisabled={
        isUsageLoading ||
        isUsageUnavailable ||
        !trimmedReason ||
        isReasonTooLong ||
        Boolean(reasonError)
      }
      isLoading={isArchiving}
      loadingLabel="Удаление..."
      onCancel={onCancel}
      onConfirm={() => void archive()}
      title="Удалить шаблон?"
      variant="danger"
    >
      <div className="checklist-template-archive-body">
        {isUsageLoading ? (
          <p className="checklist-template-archive-state">
            Проверяем привязки...
          </p>
        ) : null}

        {!isUsageLoading && hasMaintenanceSettings ? (
          <div className="checklist-template-archive-usage">
            <ul>
              {visibleSettings.map((setting) => (
                <li key={setting.id}>
                  <span>{setting.equipmentModel.name}</span>
                  <span>{setting.maintenanceType.name}</span>
                </li>
              ))}
            </ul>
            {maintenanceSettings.length > VISIBLE_USAGE_LIMIT ? (
              <button
                className="checklist-template-archive-more"
                onClick={() => setShowAllUsage((value) => !value)}
                type="button"
              >
                {showAllUsage ? "Скрыть" : "Показать все"}
              </button>
            ) : null}
          </div>
        ) : null}

        <label className="checklist-template-archive-reason" htmlFor={reasonId}>
          <span>Причина удаления</span>
          <textarea
            disabled={isArchiving}
            id={reasonId}
            maxLength={ARCHIVE_REASON_MAX_LENGTH + 1}
            onBlur={() => setIsReasonTouched(true)}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
            value={reason}
          />
        </label>
        <div className="checklist-template-archive-reason-footer">
          <span>
            {reasonError ??
              (isReasonTooLong ? "Причина удаления слишком длинная." : "")}
          </span>
          <span>
            {reason.length}/{ARCHIVE_REASON_MAX_LENGTH}
          </span>
        </div>
      </div>
    </ConfirmDialog>
  );
}
