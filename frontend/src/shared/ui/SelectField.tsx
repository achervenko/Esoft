import { SelectDropdown, type SelectDropdownOption } from "./SelectDropdown";
import "./SelectField.css";

export type SelectFieldOption = SelectDropdownOption;

export type SelectFieldProps = {
  label: string;
  options: SelectFieldOption[];
  searchable?: boolean;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  name?: string;
} & (
  | { multiple?: false; value: string; onChange: (value: string) => void }
  | { multiple: true; value: string[]; onChange: (value: string[]) => void }
);

export function SelectField(props: SelectFieldProps) {
  const {
    label,
    options,
    searchable = false,
    placeholder,
    disabled,
    required,
    error,
    name,
  } = props;
  return (
    <>
      <select
        name={name}
        hidden
        aria-hidden="true"
        tabIndex={-1}
        disabled={disabled}
        required={required}
        multiple={props.multiple}
        value={props.value}
        onChange={() => {}}
        onInvalid={(event) => {
          event.preventDefault();
          event.currentTarget.nextElementSibling
            ?.querySelector<HTMLElement>(".select-dropdown-trigger")
            ?.focus();
        }}
      >
        {!props.multiple && <option value="" />}
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
      <SelectDropdown
        className="select-field"
        alwaysDown
        menuClassName="select-field-menu"
        aria-label={label}
        label={label}
        options={options}
        searchable={searchable}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        error={error}
        value={props.multiple ? (props.value[0] ?? "") : props.value}
        selectedValues={props.multiple ? props.value : undefined}
        onSelectedValuesChange={props.multiple ? props.onChange : undefined}
        onChange={(value) => {
          if (props.multiple) {
            props.onChange(
              props.value.includes(value)
                ? props.value.filter((selected) => selected !== value)
                : [...props.value, value],
            );
          } else {
            props.onChange(value);
          }
        }}
      />
    </>
  );
}
