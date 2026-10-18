import { isEquipmentCreateFormDirty } from "../../modules/equipment-create-form/model/equipment-create-form.dirty";
import { ArrowLeft } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { EquipmentCreateForm } from '../../modules/equipment-create-form/EquipmentCreateForm';
import { toEquipmentCreatePayload } from '../../modules/equipment-create-form/model/equipment-create-form.mapper';
import {
  type EquipmentCreateFieldErrors,
  initialEquipmentCreateFormState,
  type EquipmentCreateFormState,
} from '../../modules/equipment-create-form/model/equipment-create-form.types';
import {
  getEquipmentFieldErrorsFromMessage,
  validateEquipmentCreateForm,
} from '../../modules/equipment-create-form/model/equipment-create-form.validation';
import {
  clearEquipmentCreateRedirectTimeout,
  scheduleEquipmentCreateRedirect,
} from './equipment-create-redirect';
import '../../modules/equipment-create-form/EquipmentPageLayout.css';

type EquipmentCreatePageProps = {
  userPermissions: readonly string[] | null;
};

export function EquipmentCreatePage({ userPermissions }: EquipmentCreatePageProps) {
  const { notifyError, notifySuccess, notifyWarning } = useNotifications();
  const redirectTimeoutRef = useRef<number | null>(null);
  const isSubmittingRef = useRef(false);
  const isCreateAllowed = canCreateEquipment(userPermissions);
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
      isEquipmentCreateFormDirty(form),
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

  useEffect(() => {
    return () => {
      clearEquipmentCreateRedirectTimeout(redirectTimeoutRef);
    };
  }, []);

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
    if (isSubmittingRef.current) return;
    setError(null);

    const validation = validateEquipmentCreateForm(form);
    setFieldErrors(validation.fieldErrors);

    if (validation.formError) {
      setError(validation.formError);
      notifyWarning(validation.formError);
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    let shouldResetSubmitting = true;

    try {
      await createEquipment(toEquipmentCreatePayload(form));

      notifySuccess("Оборудование добавлено");
      shouldResetSubmitting = false;
      scheduleEquipmentCreateRedirect(redirectTimeoutRef);
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
        isSubmittingRef.current = false;
        setIsSubmitting(false);
      }
    }
  };

  if (!isCreateAllowed) {
    return (
      <div className="equipment-create-page">
        <BackToRegistryLink />
        <h1 className="page-title">Добавление оборудования</h1>
        <Notice tone="error">
          У вашей роли нет доступа к добавлению оборудования.
        </Notice>
      </div>
    );
  }

  return (
    <div className="equipment-create-page">
      <UnsavedChangesGuard
        hasChanges={hasUnsavedChanges}
        isBlocked={isSubmitting}
      />
      <BackToRegistryLink />

      <header className="equipment-create-header">
        <h1 className="page-title">Добавление оборудования</h1>
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
