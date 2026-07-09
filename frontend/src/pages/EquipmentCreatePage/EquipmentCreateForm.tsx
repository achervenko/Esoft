import { Save } from 'lucide-react';
import type { EquipmentCreateOptions } from '../../shared/api/equipment-api';
import { SearchSelect } from '../../shared/ui/SearchSelect';
import {
  formatRuDate,
  type EquipmentCreateFormState,
} from './model/equipment-create-form';

type EquipmentCreateFormProps = {
  form: EquipmentCreateFormState;
  isSubmitting: boolean;
  onChange: <Key extends keyof EquipmentCreateFormState>(
    key: Key,
    value: EquipmentCreateFormState[Key],
  ) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  options: EquipmentCreateOptions;
};

export function EquipmentCreateForm({
  form,
  isSubmitting,
  onChange,
  onSubmit,
  options,
}: EquipmentCreateFormProps) {
  return (
    <form className="equipment-create-form" onSubmit={onSubmit}>
      <div className="equipment-form-grid">
        <label className="form-field form-field-small">
          <span>ID</span>
          <input
            inputMode="numeric"
            onChange={(event) =>
              onChange('visibleId', event.target.value.replace(/\D/g, ''))
            }
            placeholder="Авто"
            type="text"
            value={form.visibleId}
          />
        </label>

        <label className="form-field form-field-wide">
          <span>
            Название оборудования<b aria-hidden="true">*</b>
          </span>
          <input
            onChange={(event) => onChange('name', event.target.value)}
            type="text"
            value={form.name}
          />
        </label>

        <SearchSelect
          label="Производитель"
          onChange={(value) => onChange('manufacturerId', value)}
          options={options.manufacturers}
          value={form.manufacturerId}
        />

        <label className="form-field">
          <span>Модель</span>
          <input
            onChange={(event) => onChange('model', event.target.value)}
            type="text"
            value={form.model}
          />
        </label>

        <label className="form-field form-field-wide">
          <span>Технические характеристики</span>
          <textarea
            onChange={(event) => onChange('specifications', event.target.value)}
            rows={5}
            value={form.specifications}
          />
        </label>

        <label className="form-field">
          <span>Заводской номер</span>
          <input
            onChange={(event) => onChange('serialNumber', event.target.value)}
            type="text"
            value={form.serialNumber}
          />
        </label>

        <label className="form-field">
          <span>
            Инвентарный номер<b aria-hidden="true">*</b>
          </span>
          <input
            onChange={(event) => onChange('inventoryNumber', event.target.value)}
            type="text"
            value={form.inventoryNumber}
          />
        </label>

        <SearchSelect
          label="Страна производства"
          onChange={(value) => onChange('countryId', value)}
          options={options.countries}
          value={form.countryId}
        />

        <label className="form-field">
          <span>Год выпуска</span>
          <input
            inputMode="numeric"
            maxLength={4}
            onChange={(event) =>
              onChange(
                'manufactureYear',
                event.target.value.replace(/\D/g, '').slice(0, 4),
              )
            }
            type="text"
            value={form.manufactureYear}
          />
        </label>

        <label className="form-field">
          <span>Дата ввода в эксплуатацию</span>
          <input
            inputMode="numeric"
            onChange={(event) =>
              onChange('commissioningDate', formatRuDate(event.target.value))
            }
            placeholder="ДД.ММ.ГГГГ"
            type="text"
            value={form.commissioningDate}
          />
        </label>

        <SearchSelect
          label="Местонахождение"
          onChange={(value) => onChange('sectionId', value)}
          options={options.sections}
          required
          value={form.sectionId}
        />

        <SearchSelect
          label="Ответственный"
          onChange={(value) => onChange('responsibleEmployeeId', value)}
          options={options.employees}
          required
          value={form.responsibleEmployeeId}
        />

        <label className="form-field">
          <span>
            Статус<b aria-hidden="true">*</b>
          </span>
          <select
            onChange={(event) => onChange('status', event.target.value)}
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
            onChange={(event) => onChange('operationText', event.target.value)}
            rows={5}
            value={form.operationText}
          />
        </label>

        <label className="form-field form-field-wide">
          <span>Примечания</span>
          <textarea
            onChange={(event) => onChange('notes', event.target.value)}
            rows={5}
            value={form.notes}
          />
        </label>
      </div>

      <div className="equipment-form-actions">
        <a className="equipment-secondary-button" href="#/equipment">
          Отмена
        </a>
        <button
          className="equipment-submit-button"
          disabled={isSubmitting}
          type="submit"
        >
          <Save aria-hidden="true" size={18} />
          <span>{isSubmitting ? 'Сохранение...' : 'Сохранить'}</span>
        </button>
      </div>
    </form>
  );
}
