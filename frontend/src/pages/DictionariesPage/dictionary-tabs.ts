import { hasPermission } from "../../shared/lib/permissions";

const manage = ["dictionaries.manage"];
export const dictionaryTabs = [
  {
    id: "employees",
    label: "Сотрудники",
    permissions: [...manage, "ppe.employee-sizes.manage"],
  },
  { id: "positions", label: "Должности", permissions: manage },
  { id: "manufacturers", label: "Производители", permissions: manage },
  { id: "countries", label: "Страны", permissions: manage },
  { id: "locations", label: "Местонахождения", permissions: manage },
  {
    id: "storageLocations",
    label: "Места хранения",
    permissions: ["warehouse.storage-locations.read"],
  },
] as const;

export type ActiveDictionariesTab = (typeof dictionaryTabs)[number]["id"];

export function getAvailableDictionaryTabs(
  permissions: readonly string[] | null,
) {
  return dictionaryTabs.filter((tab) =>
    tab.permissions.some((permission) =>
      hasPermission(permissions, permission),
    ),
  );
}
