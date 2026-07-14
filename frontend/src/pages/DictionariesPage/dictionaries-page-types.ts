import type { AdminEmployee } from "../../shared/api/users-admin-api";
import type {
  DictionaryCountry,
  DictionaryEquipmentModel,
  DictionaryLocation,
  DictionaryManufacturer,
  DictionaryObject,
} from "../../shared/api/dictionaries-admin-api";

export type ActiveDictionariesTab =
  "employees" | "manufacturers" | "countries" | "locations";

export type EmployeeDictionaryFormState = AdminEmployee | "new" | null;
export type ManufacturerFormState = DictionaryManufacturer | "new" | null;
export type EquipmentModelFormState = DictionaryEquipmentModel | "new" | null;
export type CountryFormState = DictionaryCountry | "new" | null;
export type ObjectFormState = DictionaryObject | "new" | null;
export type LocationFormState = DictionaryLocation | "new" | null;
