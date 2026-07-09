import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  createEquipment,
  getEquipmentCreateOptions,
  type EquipmentCreateOptions,
} from '../../shared/api/equipment-api';
import { EquipmentCreateForm } from './EquipmentCreateForm';
import {
  initialEquipmentCreateFormState,
  toEquipmentCreatePayload,
  validateEquipmentCreateForm,
  type EquipmentCreateFormState,
} from './model/equipment-create-form';
import './EquipmentCreatePage.css';

type EquipmentCreatePageProps = {
  userRole: string | null;
};

const rolesAllowedToCreateEquipment = new Set([
  'admin',
  'engineer',
  'chief_engineer',
]);

export function EquipmentCreatePage({ userRole }: EquipmentCreatePageProps) {
  const canCreateEquipment = Boolean(
    userRole && rolesAllowedToCreateEquipment.has(userRole),
  );
  const [form, setForm] = useState<EquipmentCreateFormState>(
    initialEquipmentCreateFormState,
  );
  const [options, setOptions] = useState<EquipmentCreateOptions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    getEquipmentCreateOptions()
      .then((data) => {
        if (isMounted) {
          setOptions(data);
          setForm((currentForm) => ({
            ...currentForm,
            visibleId: String(data.nextVisibleId),
            status: data.statuses[0]?.value ?? 'ACTIVE',
          }));
        }
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
  }, []);

  const updateForm = <Key extends keyof EquipmentCreateFormState>(
    key: Key,
    value: EquipmentCreateFormState[Key],
  ) => {
    setForm((currentForm) => ({ ...currentForm, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const validationError = validateEquipmentCreateForm(form);

    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      await createEquipment(toEquipmentCreatePayload(form));

      setMessage('Оборудование добавлено.');
      window.setTimeout(() => {
        window.location.hash = '#/equipment';
      }, 500);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Не удалось добавить оборудование.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!canCreateEquipment) {
    return (
      <div className="equipment-create-page">
        <BackToRegistryLink />
        <h1>Добавление оборудования</h1>
        <p className="equipment-form-message error">
          У вашей роли нет доступа к добавлению оборудования.
        </p>
      </div>
    );
  }

  return (
    <div className="equipment-create-page">
      <BackToRegistryLink />

      <header className="equipment-create-header">
        <h1>Добавление оборудования</h1>
      </header>

      {isLoading ? (
        <p className="equipment-form-message">Загрузка справочников...</p>
      ) : null}
      {error ? <p className="equipment-form-message error">{error}</p> : null}
      {message ? (
        <p className="equipment-form-message success">{message}</p>
      ) : null}

      {options ? (
        <EquipmentCreateForm
          form={form}
          isSubmitting={isSubmitting}
          onChange={updateForm}
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
