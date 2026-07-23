import { ArrowLeft } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { canCreateEquipment } from '../../modules/equipment-permissions';
import { getApiErrorMessage } from '../../shared/api/api-error';
import {
  createEquipment,
  getEquipmentCreateOptions,
} from '../../shared/api/equipment/equipment.api';
import type { EquipmentCreateOptions } from '../../shared/api/equipment/equipment.types';
import { Notice } from '../../shared/ui/Notice';
import { UnsavedChangesGuard } from '../../shared/ui/UnsavedChangesGuard';
import { useNotifications } from '../../shared/ui/notifications';
import { EquipmentCreateForm } from './EquipmentCreateForm';
import { toEquipmentCreatePayload } from './model/equipment-create-form.mapper';
import {
  type EquipmentCreateFieldErrors,
  initialEquipmentCreateFormState,
  type EquipmentCreateFormState,
} from './model/equipment-create-form.types';
import {
  getEquipmentFieldErrorsFromMessage,
  validateEquipmentCreateForm,
} from './model/equipment-create-form.validation';
import './EquipmentCreatePage.css';

type EquipmentCreatePageProps = {
  userRole: string | null;
};

export function EquipmentCreatePage({ userRole }: EquipmentCreatePageProps) {
  const { notifyError, notifySuccess, notifyWarning } = useNotifications();
  const isCreateAllowed = canCreateEquipment(userRole);
  const [form, setForm] = useState<EquipmentCreateFormState>(
    initialEquipmentCreateFormState,
  );
  const [options, setOptions] = useState<EquipmentCreateOptions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<EquipmentCreateFieldErrors>({});
  const [error, setError] = useState<string | null>(null);

  const hasUnsavedChanges = useMemo(
    () =>
      JSON.stringify(getCreateComparableForm(form)) !==
      JSON.stringify(getCreateComparableForm(initialEquipmentCreateFormState)),
    [form],
  );

  useEffect(() => {
    let isMounted = true;

    if (!isCreateAllowed) {
      setIsLoading(false);
      return () => {
        isMounted = false;
      };
    }

    getEquipmentCreateOptions()
      .then((data) => {
        if (isMounted) {
          setOptions(data);
          setForm((currentForm) => ({
            ...currentForm,
            visibleId: String(data.nextVisibleId),
          }));
        }
      })
      .catch((requestError) => {
        if (isMounted) {
          const errorMessage = getApiErrorMessage(requestError);
          setError(errorMessage);
          notifyError("Не удалось загрузить справочники оборудования", errorMessage);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isCreateAllowed, notifyError]);

  const updateForm = <Key extends keyof EquipmentCreateFormState>(
    key: Key,
    value: EquipmentCreateFormState[Key],
  ) => {
    setForm((currentForm) => ({ ...currentForm, [key]: value }));
  };

  const handleFieldFocus = (key: keyof EquipmentCreateFormState) => {
    if (fieldErrors[key]) {
      setError(null);
      setFieldErrors((currentErrors) => ({
        ...currentErrors,
        [key]: undefined,
      }));
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const validation = validateEquipmentCreateForm(form);
    setFieldErrors(validation.fieldErrors);

    if (validation.formError) {
      setError(validation.formError);
      notifyWarning(validation.formError);
      return;
    }

    setIsSubmitting(true);
    let shouldResetSubmitting = true;

    try {
      await createEquipment(toEquipmentCreatePayload(form));

      notifySuccess("Оборудование добавлено");
      shouldResetSubmitting = false;
      window.setTimeout(() => {
        window.location.hash = '#/equipment';
      }, 500);
    } catch (requestError) {
      const errorMessage = getApiErrorMessage(
        requestError,
        'Не удалось добавить оборудование.',
      );

      setError(errorMessage);
      notifyError("Не удалось добавить оборудование", errorMessage);
      setFieldErrors((currentErrors) => ({
        ...currentErrors,
        ...getEquipmentFieldErrorsFromMessage(errorMessage),
      }));
    } finally {
      if (shouldResetSubmitting) {
        setIsSubmitting(false);
      }
    }
  };

  if (!isCreateAllowed) {
    return (
      <div className="equipment-create-page">
        <BackToRegistryLink />
        <h1>Добавление оборудования</h1>
        <Notice tone="error">
          У вашей роли нет доступа к добавлению оборудования.
        </Notice>
      </div>
    );
  }

  return (
    <div className="equipment-create-page">
      <UnsavedChangesGuard hasChanges={hasUnsavedChanges} />
      <BackToRegistryLink />

      <header className="equipment-create-header">
        <h1>Добавление оборудования</h1>
      </header>

      {isLoading ? <Notice>Загрузка справочников...</Notice> : null}
      {error ? (
        <Notice floating tone="error">
          {error}
        </Notice>
      ) : null}
      {options ? (
        <EquipmentCreateForm
          fieldErrors={fieldErrors}
          form={form}
          isSubmitting={isSubmitting}
          onChange={updateForm}
          onFieldFocus={handleFieldFocus}
          onSubmit={handleSubmit}
          options={options}
        />
      ) : null}
    </div>
  );
}

function BackToRegistryLink() {
  return (
    <a className="equipment-back-link" href="#/equipment">
      <ArrowLeft aria-hidden="true" size={18} />
      <span>К реестру</span>
    </a>
  );
}

function getCreateComparableForm(form: EquipmentCreateFormState) {
  const { visibleId: _visibleId, ...comparableForm } = form;
  return comparableForm;
}
