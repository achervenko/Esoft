import { Plus } from "lucide-react";

type MaintenanceSettingsPanelHeaderProps = {
  availableTypesError: string | null;
  canManage: boolean;
  isAvailableTypesLoading: boolean;
  isCreateDisabled: boolean;
  onCreate: () => void;
  onReloadAvailableTypes: () => void;
};

export function MaintenanceSettingsPanelHeader({
  availableTypesError,
  canManage,
  isAvailableTypesLoading,
  isCreateDisabled,
  onCreate,
  onReloadAvailableTypes,
}: MaintenanceSettingsPanelHeaderProps) {
  return (
    <>
      <header>
        <div>
          <h2>Настройки обслуживания</h2>
        </div>

        {canManage ? (
          <div className="maintenance-settings-actions">
            <button
              className="admin-primary-button"
              disabled={isCreateDisabled}
              onClick={onCreate}
              type="button"
            >
              <Plus aria-hidden="true" size={17} />
              Добавить настройку
            </button>
          </div>
        ) : null}
      </header>

      {canManage && availableTypesError ? (
        <div className="maintenance-settings-inline-error">
          <span>Не удалось загрузить доступные виды обслуживания.</span>
          <button
            disabled={isAvailableTypesLoading}
            onClick={onReloadAvailableTypes}
            type="button"
          >
            Повторить
          </button>
        </div>
      ) : null}
    </>
  );
}
