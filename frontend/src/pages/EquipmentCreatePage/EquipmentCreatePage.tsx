import { ArrowLeft, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  createEquipment,
  getEquipmentCreateOptions,
  type EquipmentCreateOptions,
} from '../../shared/api/equipment-api';
import { SearchSelect } from '../../shared/ui/SearchSelect';
import './EquipmentCreatePage.css';

type EquipmentCreatePageProps = {
  userRole: string | null;
};

type FormState = {
  id: string;
  name: string;
  manufacturerId: number | null;
  model: string;
  specifications: string;
  serialNumber: string;
  inventoryNumber: string;
  countryId: number | null;
  manufactureYear: string;
  commissioningDate: string;
  sectionId: number | null;
  responsibleEmployeeId: number | null;
  status: string;
  operationText: string;
  notes: string;
};

const rolesAllowedToCreateEquipment = new Set(['admin', 'engineer', 'chief_engineer']);

const initialFormState: FormState = {
  id: '',
  name: '',
  manufacturerId: null,
  model: '',
  specifications: '',
  serialNumber: '',
  inventoryNumber: '',
  countryId: null,
  manufactureYear: '',
  commissioningDate: '',
  sectionId: null,
  responsibleEmployeeId: null,
  status: 'ACTIVE',
  operationText: '',
  notes: '',
};

function formatRuDate(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
  return parts.join('.');
}

function toOptionalNumber(value: string) {
  const cleanValue = value.trim();
  return cleanValue ? Number(cleanValue) : undefined;
}

function toOptionalText(value: string) {
  const cleanValue = value.trim();
  return cleanValue || null;
}

export function EquipmentCreatePage({ userRole }: EquipmentCreatePageProps) {
  const canCreateEquipment = Boolean(userRole && rolesAllowedToCreateEquipment.has(userRole));
  const [form, setForm] = useState<FormState>(initialFormState);
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
            id: String(data.nextId),
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

  const updateForm = <Key extends keyof FormState>(key: Key, value: FormState[Key]) => {
    setForm((currentForm) => ({ ...currentForm, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!form.name.trim()) {
      setError('Укажите название оборудования.');
      return;
    }

    if (!form.inventoryNumber.trim()) {
      setError('Укажите инвентарный номер.');
      return;
    }

    if (!form.sectionId) {
      setError('Выберите местонахождение.');
      return;
    }

    if (!form.responsibleEmployeeId) {
      setError('Выберите ответственного.');
      return;
    }

    if (!form.status) {
      setError('Выберите статус.');
      return;
    }

    setIsSubmitting(true);

    try {
      await createEquipment({
        id: toOptionalNumber(form.id),
        name: form.name.trim(),
        manufacturerId: form.manufacturerId,
        model: toOptionalText(form.model),
        specifications: toOptionalText(form.specifications),
        serialNumber: toOptionalText(form.serialNumber),
        inventoryNumber: form.inventoryNumber.trim(),
        countryId: form.countryId,
        manufactureYear: toOptionalNumber(form.manufactureYear) ?? null,
        commissioningDate: toOptionalText(form.commissioningDate),
        sectionId: form.sectionId,
        responsibleEmployeeId: form.responsibleEmployeeId,
        status: form.status,
        operationText: toOptionalText(form.operationText),
        notes: toOptionalText(form.notes),
      });

      setMessage('Оборудование добавлено.');
      window.setTimeout(() => {
        window.location.hash = '#/equipment';
      }, 500);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Не удалось добавить оборудование.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!canCreateEquipment) {
    return (
      <div className="equipment-create-page">
        <a className="equipment-back-link" href="#/equipment">
          <ArrowLeft aria-hidden="true" size={18} />
          <span>К реестру</span>
        </a>
        <h1>Добавление оборудования</h1>
        <p className="equipment-form-message error">У вашей роли нет доступа к добавлению оборудования.</p>
      </div>
    );
  }

  return (
    <div className="equipment-create-page">
      <a className="equipment-back-link" href="#/equipment">
        <ArrowLeft aria-hidden="true" size={18} />
        <span>К реестру</span>
      </a>

      <header className="equipment-create-header">
        <h1>Добавление оборудования</h1>
      </header>

      {isLoading ? <p className="equipment-form-message">Загрузка справочников...</p> : null}
      {error ? <p className="equipment-form-message error">{error}</p> : null}
      {message ? <p className="equipment-form-message success">{message}</p> : null}

      {options ? (
        <form className="equipment-create-form" onSubmit={handleSubmit}>
          <div className="equipment-form-grid">
            <label className="form-field form-field-small">
              <span>ID</span>
              <input
                inputMode="numeric"
                onChange={(event) => updateForm('id', event.target.value.replace(/\D/g, ''))}
                placeholder="Авто"
                type="text"
                value={form.id}
              />
            </label>

            <label className="form-field form-field-wide">
              <span>Название оборудования<b aria-hidden="true">*</b></span>
              <input
                onChange={(event) => updateForm('name', event.target.value)}
                type="text"
                value={form.name}
              />
            </label>

            <SearchSelect
              label="Производитель"
              onChange={(value) => updateForm('manufacturerId', value)}
              options={options.manufacturers}
              value={form.manufacturerId}
            />

            <label className="form-field">
              <span>Модель</span>
              <input
                onChange={(event) => updateForm('model', event.target.value)}
                type="text"
                value={form.model}
              />
            </label>

            <label className="form-field form-field-wide">
              <span>Технические характеристики</span>
              <textarea
                onChange={(event) => updateForm('specifications', event.target.value)}
                rows={5}
                value={form.specifications}
              />
            </label>

            <label className="form-field">
              <span>Заводской номер</span>
              <input
                onChange={(event) => updateForm('serialNumber', event.target.value)}
                type="text"
                value={form.serialNumber}
              />
            </label>

            <label className="form-field">
              <span>Инвентарный номер<b aria-hidden="true">*</b></span>
              <input
                onChange={(event) => updateForm('inventoryNumber', event.target.value)}
                type="text"
                value={form.inventoryNumber}
              />
            </label>

            <SearchSelect
              label="Страна производства"
              onChange={(value) => updateForm('countryId', value)}
              options={options.countries}
              value={form.countryId}
            />

            <label className="form-field">
              <span>Год выпуска</span>
              <input
                inputMode="numeric"
                maxLength={4}
                onChange={(event) =>
                  updateForm('manufactureYear', event.target.value.replace(/\D/g, '').slice(0, 4))
                }
                type="text"
                value={form.manufactureYear}
              />
            </label>

            <label className="form-field">
              <span>Дата ввода в эксплуатацию</span>
              <input
                inputMode="numeric"
                onChange={(event) => updateForm('commissioningDate', formatRuDate(event.target.value))}
                placeholder="ДД.ММ.ГГГГ"
                type="text"
                value={form.commissioningDate}
              />
            </label>

            <SearchSelect
              label="Местонахождение"
              onChange={(value) => updateForm('sectionId', value)}
              options={options.sections}
              required
              value={form.sectionId}
            />

            <SearchSelect
              label="Ответственный"
              onChange={(value) => updateForm('responsibleEmployeeId', value)}
              options={options.employees}
              required
              value={form.responsibleEmployeeId}
            />

            <label className="form-field">
              <span>Статус<b aria-hidden="true">*</b></span>
              <select
                onChange={(event) => updateForm('status', event.target.value)}
                value={form.status}
              >
                {options.statuses.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field form-field-wide">
              <span>Технологическая операция</span>
              <textarea
                onChange={(event) => updateForm('operationText', event.target.value)}
                rows={5}
                value={form.operationText}
              />
            </label>

            <label className="form-field form-field-wide">
              <span>Примечания</span>
              <textarea
                onChange={(event) => updateForm('notes', event.target.value)}
                rows={5}
                value={form.notes}
              />
            </label>
          </div>

          <div className="equipment-form-actions">
            <a className="equipment-secondary-button" href="#/equipment">
              Отмена
            </a>
            <button className="equipment-submit-button" disabled={isSubmitting} type="submit">
              <Save aria-hidden="true" size={18} />
              <span>{isSubmitting ? 'Сохранение...' : 'Сохранить'}</span>
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
