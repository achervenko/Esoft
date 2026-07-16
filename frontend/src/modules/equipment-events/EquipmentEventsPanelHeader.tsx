import { Plus } from "lucide-react";

type EquipmentEventsPanelHeaderProps = {
  canManageEvents: boolean;
  formDataError: string | null;
  isCreateDisabled: boolean;
  isFormDataLoading: boolean;
  onCreate: () => void;
  onReloadFormData: () => void;
  shouldShowMissingSettings: boolean;
};

export function EquipmentEventsPanelHeader({
  canManageEvents,
  formDataError,
  isCreateDisabled,
  isFormDataLoading,
  onCreate,
  onReloadFormData,
  shouldShowMissingSettings,
}: EquipmentEventsPanelHeaderProps) {
  return (
    <>
      <header>
        <div>
          <h2>События</h2>
        </div>

        {canManageEvents ? (
          <button
            className="admin-primary-button"
            disabled={isCreateDisabled}
            onClick={onCreate}
            type="button"
          >
            <Plus aria-hidden="true" size={17} />
            Назначить событие
          </button>
        ) : null}
      </header>

      {canManageEvents && formDataError ? (
        <div className="equipment-events-inline-error">
          <span>{formDataError}</span>
          <button
            disabled={isFormDataLoading}
            onClick={onReloadFormData}
            type="button"
          >
            Повторить
          </button>
        </div>
      ) : null}

      {shouldShowMissingSettings ? (
        <p className="admin-state">
          Для создания события сначала добавьте настройку обслуживания модели.
        </p>
      ) : null}
    </>
  );
}
