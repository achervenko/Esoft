import type {
  AdminEmployee,
  AdminPosition,
  EmployeePayload,
} from "../../shared/api/users-admin-api";
import type {
  DictionaryCountry,
  DictionaryEquipmentModel,
  DictionaryLocation,
  DictionaryManufacturer,
  DictionaryObject,
  CountryPayload,
  EquipmentModelPayload,
  LocationPayload,
} from "../../shared/api/dictionaries-admin-api";
import type {
  ActiveDictionariesTab,
  CountryFormState,
  EmployeeDictionaryFormState,
  EquipmentModelFormState,
  LocationFormState,
  ManufacturerFormState,
  ObjectFormState,
  PositionFormState,
} from "./dictionaries-page-types";

export type DictionariesContentModel = {
  activeTab: ActiveDictionariesTab;
  isLoading: boolean;
  isSaving: boolean;
  positions: AdminPosition[];
  employees: AdminEmployee[];
  manufacturers: DictionaryManufacturer[];
  models: DictionaryEquipmentModel[];
  countries: DictionaryCountry[];
  locations: DictionaryLocation[];
  objects: DictionaryObject[];
  setPositionForm: (value: PositionFormState) => void;
  setEmployeeForm: (value: EmployeeDictionaryFormState) => void;
  setManufacturerForm: (value: ManufacturerFormState) => void;
  setModelForm: (value: EquipmentModelFormState) => void;
  setCountryForm: (value: CountryFormState) => void;
  setLocationForm: (value: LocationFormState) => void;
  setObjectForm: (value: ObjectFormState) => void;
  togglePositionStatus: (value: AdminPosition) => Promise<void>;
  toggleEmployeeStatus: (value: AdminEmployee) => Promise<void>;
  removeManufacturer: (value: DictionaryManufacturer) => Promise<void>;
  removeModel: (value: DictionaryEquipmentModel) => Promise<void>;
  removeCountry: (value: DictionaryCountry) => Promise<void>;
  removeLocation: (value: DictionaryLocation) => Promise<void>;
  removeObject: (value: DictionaryObject) => Promise<void>;
};

export type DictionariesModalsModel = {
  isSaving: boolean;
  positions: AdminPosition[];
  manufacturers: DictionaryManufacturer[];
  objects: DictionaryObject[];
  positionForm: PositionFormState;
  employeeForm: EmployeeDictionaryFormState;
  manufacturerForm: ManufacturerFormState;
  modelForm: EquipmentModelFormState;
  countryForm: CountryFormState;
  locationForm: LocationFormState;
  objectForm: ObjectFormState;
  setPositionForm: (value: PositionFormState) => void;
  setEmployeeForm: (value: EmployeeDictionaryFormState) => void;
  setManufacturerForm: (value: ManufacturerFormState) => void;
  setModelForm: (value: EquipmentModelFormState) => void;
  setCountryForm: (value: CountryFormState) => void;
  setLocationForm: (value: LocationFormState) => void;
  setObjectForm: (value: ObjectFormState) => void;
  savePosition: (payload: { name: string }) => Promise<void>;
  saveEmployee: (payload: EmployeePayload) => Promise<void>;
  saveManufacturer: (payload: { name: string }) => Promise<void>;
  saveModel: (payload: EquipmentModelPayload) => Promise<void>;
  saveCountry: (payload: CountryPayload) => Promise<void>;
  saveLocation: (payload: LocationPayload) => Promise<void>;
  saveObject: (payload: { name: string }) => Promise<void>;
};
