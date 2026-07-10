import { ArrowLeft } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { canEditEquipment } from '../../modules/equipment-permissions';
import {
  getEquipmentCard,
  getEquipmentCreateOptions,
  updateEquipment,
  type EquipmentCreateOptions,
} from '../../shared/api/equipment-api';
import { Notice } from '../../shared/ui/Notice';
import { UnsavedChangesGuard } from '../../shared/ui/UnsavedChangesGuard';
import { EquipmentCreateForm } from '../EquipmentCreatePage/EquipmentCreateForm';
import {
  type EquipmentCreateFieldErrors,
  initialEquipmentCreateFormState,
  toEquipmentCreatePayload,
  toEquipmentFormState,
  validateEquipmentCreateForm,
  type EquipmentCreateFormState,
} from '../EquipmentCreatePage/model/equipment-create-form';
import '../EquipmentCreatePage/EquipmentCreatePage.css';

type EquipmentEditPageProps = {
  userRole: string | null;
  visibleId: number;
};

export function EquipmentEditPage({
  userRole,
  visibleId,
}: EquipmentEditPageProps) {
  const isEditAllowed = canEditEquipment(userRole);
  const [form, setForm] = useState<EquipmentCreateFormState>(
    initialEquipmentCreateFormState,
  );
  const [initialForm, setInitialForm] = useState<EquipmentCreateFormState | null>(
    null,
  );
  const [options, setOptions] = useState<EquipmentCreateOptions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<EquipmentCreateFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const hasUnsavedChanges = useMemo(
    () => Boolean(initialForm && JSON.stringify(form) !== JSON.stringify(initialForm)),
    [form, initialForm],
  );

  useEffect(() => {
    let isMounted = true;

    Promise.all([getEquipmentCreateOptions(), getEquipmentCard(visibleId)])
      .then(([optionsData, equipment]) => {
        if (!isMounted) {
          return;
        }

        const formState = toEquipmentFormState(equipment);
        setOptions(optionsData);
        setForm(formState);
        setInitialForm(formState);
      })
      .catch((requestError: Error) => {
        if (isMounted) {
          setError(requestError.message);
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
  }, [visibleId]);

  const updateForm = <Key extends keyof EquipmentCreateFormState>(
    key: Key,
    value: EquipmentCreateFormState[Key],
  ) => {
    setForm((currentForm) => ({ ...currentForm, [key]: value }));
  };

  const handleFieldFocus = (key: keyof EquipmentCreateFormState) => {
    if (fieldErrors[key]) {
      setError(null);
      setMessage(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const validation = validateEquipmentCreateForm(form);
    setFieldErrors(validation.fieldErrors);

    if (validation.formError) {
      setError(validation.formError);
      return;
    }

    setIsSubmitting(true);

    try {
      const updatedEquipment = await updateEquipment(
        visibleId,
        toEquipmentCreatePayload(form),
      );

      setMessage('Оборудование сохранено.');
      const updatedForm = toEquipmentFormState(updatedEquipment);
      setInitialForm(updatedForm);
      setForm(updatedForm);

      window.setTimeout(() => {
        window.location.hash = `#/equipment/${updatedEquipment.visibleId}`;
      }, 500);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Не удалось сохранить оборудование.',
      );
      if (
        requestError instanceof Error &&
        requestError.message.toLowerCase().includes('id')
      ) {
        setFieldErrors((currentErrors) => ({
          ...currentErrors,
          visibleId: requestError.message,
        }));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isEditAllowed) {
    return (
      <div className="equipment-create-page">
        <BackToCardLink visibleId={visibleId} />
        <h1>Редактирование оборудования</h1>
        <Notice tone="error">
          У вашей роли нет доступа к редактированию оборудования.
        </Notice>
      </div>
    );
  }

  return (
    <div className="equipment-create-page">
      <UnsavedChangesGuard hasChanges={hasUnsavedChanges} />
      <BackToCardLink visibleId={visibleId} />

      <header className="equipment-create-header">
        <h1>Редактирование оборудования</h1>
      </header>

      {isLoading ? <Notice>Загрузка карточки оборудования...</Notice> : null}
      {error ? <Notice floating tone="error">{error}</Notice> : null}
      {message ? <Notice floating tone="success">{message}</Notice> : null}

      {options ? (
        <EquipmentCreateForm
          fieldErrors={fieldErrors}
          form={form}
          isSubmitting={isSubmitting}
          onChange={updateForm}
          onFieldFocus={handleFieldFocus}
          onSubmit={handleSubmit}
          options={options}
          submitLabel="Сохранить изменения"
          submittingLabel="Сохранение..."
        />
      ) : null}
    </div>
  );
}

function BackToCardLink({ visibleId }: { visibleId: number }) {
  return (
    <a className="equipment-back-link" href={`#/equipment/${visibleId}`}>
      <ArrowLeft aria-hidden="true" size={18} />
      <span>К карточке</span>
    </a>
  );
}
