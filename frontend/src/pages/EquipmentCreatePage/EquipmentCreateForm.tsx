import { Save } from 'lucide-react';
import type { EquipmentCreateOptions } from '../../shared/api/equipment/equipment.types';
import { SearchSelect } from '../../shared/ui/SearchSelect';
import { SelectDropdown } from '../../shared/ui/SelectDropdown';
import { formatRuDate } from './model/equipment-create-form.formatters';
import type {
  EquipmentCreateFieldErrors,
  EquipmentCreateFormState,
} from './model/equipment-create-form.types';

type EquipmentCreateFormProps = {
  fieldErrors: EquipmentCreateFieldErrors;
  form: EquipmentCreateFormState;
  isSubmitting: boolean;
  onChange: <Key extends keyof EquipmentCreateFormState>(
    key: Key,
    value: EquipmentCreateFormState[Key],
  ) => void;
  onFieldFocus: (key: keyof EquipmentCreateFormState) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  options: EquipmentCreateOptions;
  submitLabel?: string;
  submittingLabel?: string;
};

export function EquipmentCreateForm({
  fieldErrors,
  form,
  isSubmitting,
  onChange,
  onFieldFocus,
  onSubmit,
  options,
  submitLabel = 'Сохранить',
  submittingLabel = 'Сохранение...',
}: EquipmentCreateFormProps) {
  const modelOptions = options.models.filter(
    (model) => model.manufacturerId === form.manufacturerId,
  );

  const handleManufacturerChange = (value: number | null) => {
    onChange('manufacturerId', value);

    if (
      form.modelId &&
      !options.models.some(
        (model) => model.id === form.modelId && model.manufacturerId === value,
      )
    ) {
      onChange('modelId', null);
    }
  };

  return (
    <form className="equipment-create-form" onSubmit={onSubmit}>
      <div className="equipment-form-grid">
        <label className={`form-field form-field-small${fieldErrors.visibleId ? ' has-error' : ''}`}>
          <span>ID</span>
          <input
            inputMode="numeric"
            onChange={(event) =>
              onChange('visibleId', event.target.value.replace(/\D/g, ''))
            }
            onFocus={() => onFieldFocus('visibleId')}
            placeholder="Авто"
            type="text"
            value={form.visibleId}
          />
          {fieldErrors.visibleId ? (
            <small className="field-error">{fieldErrors.visibleId}</small>
          ) : null}
        </label>

        <label className={`form-field form-field-wide${fieldErrors.name ? ' has-error' : ''}`}>
          <span>
            Название оборудования<b aria-hidden="true">*</b>
          </span>
          <input
            onChange={(event) => onChange('name', event.target.value)}
            onFocus={() => onFieldFocus('name')}
            type="text"
            value={form.name}
          />
          {fieldErrors.name ? (
            <small className="field-error">{fieldErrors.name}</small>
          ) : null}
        </label>

        <SearchSelect
          label="Производитель"
          error={fieldErrors.manufacturerId}
          onChange={handleManufacturerChange}
          onFocus={() => onFieldFocus('manufacturerId')}
          options={options.manufacturers}
          required
          value={form.manufacturerId}
        />

        <SearchSelect
          label="Модель"
          error={fieldErrors.modelId}
          onChange={(value) => onChange('modelId', value)}
          onFocus={() => onFieldFocus('modelId')}
          options={modelOptions}
          placeholder={
            form.manufacturerId
              ? "Выберите модель"
              : "Сначала выберите производителя"
          }
          required
          value={form.modelId}
        />

        <label className={`form-field form-field-wide${fieldErrors.specifications ? ' has-error' : ''}`}>
          <span>Технические характеристики</span>
          <textarea
            onChange={(event) => onChange('specifications', event.target.value)}
            onFocus={() => onFieldFocus('specifications')}
            rows={5}
            value={form.specifications}
          />
          {fieldErrors.specifications ? (
            <small className="field-error">{fieldErrors.specifications}</small>
          ) : null}
        </label>

        <label className={`form-field${fieldErrors.serialNumber ? ' has-error' : ''}`}>
          <span>Заводской номер</span>
          <input
            onChange={(event) => onChange('serialNumber', event.target.value)}
            onFocus={() => onFieldFocus('serialNumber')}
            type="text"
            value={form.serialNumber}
          />
          {fieldErrors.serialNumber ? (
            <small className="field-error">{fieldErrors.serialNumber}</small>
          ) : null}
        </label>

        <label className={`form-field${fieldErrors.inventoryNumber ? ' has-error' : ''}`}>
          <span>
            Инвентарный номер<b aria-hidden="true">*</b>
          </span>
          <input
            onChange={(event) => onChange('inventoryNumber', event.target.value)}
            onFocus={() => onFieldFocus('inventoryNumber')}
            type="text"
            value={form.inventoryNumber}
          />
          {fieldErrors.inventoryNumber ? (
            <small className="field-error">{fieldErrors.inventoryNumber}</small>
          ) : null}
        </label>

        <SearchSelect
          label="Страна производства"
          error={fieldErrors.countryId}
          onChange={(value) => onChange('countryId', value)}
          onFocus={() => onFieldFocus('countryId')}
          options={options.countries}
          value={form.countryId}
        />

        <label className={`form-field${fieldErrors.manufactureYear ? ' has-error' : ''}`}>
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
            onFocus={() => onFieldFocus('manufactureYear')}
            type="text"
            value={form.manufactureYear}
          />
          {fieldErrors.manufactureYear ? (
            <small className="field-error">{fieldErrors.manufactureYear}</small>
          ) : null}
        </label>

        <label className={`form-field${fieldErrors.commissioningDate ? ' has-error' : ''}`}>
          <span>Дата ввода в эксплуатацию</span>
          <input
            inputMode="numeric"
            onChange={(event) =>
              onChange('commissioningDate', formatRuDate(event.target.value))
            }
            onFocus={() => onFieldFocus('commissioningDate')}
            placeholder="ДД.ММ.ГГГГ"
            type="text"
            value={form.commissioningDate}
          />
          {fieldErrors.commissioningDate ? (
            <small className="field-error">{fieldErrors.commissioningDate}</small>
          ) : null}
        </label>

        <SearchSelect
          label="Местонахождение"
          error={fieldErrors.sectionId}
          onChange={(value) => onChange('sectionId', value)}
          onFocus={() => onFieldFocus('sectionId')}
          options={options.sections}
          required
          value={form.sectionId}
        />

        <SearchSelect
          label="Ответственный"
          error={fieldErrors.responsibleEmployeeId}
          onChange={(value) => onChange('responsibleEmployeeId', value)}
          onFocus={() => onFieldFocus('responsibleEmployeeId')}
          options={options.employees}
          required
          value={form.responsibleEmployeeId}
        />

        <label className={`form-field${fieldErrors.issueDate ? ' has-error' : ''}`}>
          <span>
            Дата выдачи<b aria-hidden="true">*</b>
          </span>
          <input
            inputMode="numeric"
            onChange={(event) =>
              onChange('issueDate', formatRuDate(event.target.value))
            }
            onFocus={() => onFieldFocus('issueDate')}
            placeholder="ДД.ММ.ГГГГ"
            type="text"
            value={form.issueDate}
          />
          {fieldErrors.issueDate ? (
            <small className="field-error">{fieldErrors.issueDate}</small>
          ) : null}
        </label>

        <SelectDropdown
          label="Статус"
          error={fieldErrors.status}
          onChange={(value) => onChange('status', value)}
          onFocus={() => onFieldFocus('status')}
          options={options.statuses}
          placeholder="Выберите статус"
          required
          value={form.status}
        />

        <label className={`form-field form-field-wide${fieldErrors.operationText ? ' has-error' : ''}`}>
          <span>Технологическая операция</span>
          <textarea
            onChange={(event) => onChange('operationText', event.target.value)}
            onFocus={() => onFieldFocus('operationText')}
            rows={5}
            value={form.operationText}
          />
          {fieldErrors.operationText ? (
            <small className="field-error">{fieldErrors.operationText}</small>
          ) : null}
        </label>

        <label className={`form-field form-field-wide${fieldErrors.notes ? ' has-error' : ''}`}>
          <span>Примечание</span>
          <textarea
            onChange={(event) => onChange('notes', event.target.value)}
            onFocus={() => onFieldFocus('notes')}
            rows={5}
            value={form.notes}
          />
          {fieldErrors.notes ? (
            <small className="field-error">{fieldErrors.notes}</small>
          ) : null}
        </label>
      </div>

      <div className="equipment-form-actions">
        <button
          className="equipment-submit-button"
          disabled={isSubmitting}
          type="submit"
        >
          <Save aria-hidden="true" size={18} />
          <span>{isSubmitting ? submittingLabel : submitLabel}</span>
        </button>
      </div>
    </form>
  );
}
