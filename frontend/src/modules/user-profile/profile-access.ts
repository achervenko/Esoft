import { hasPermission } from "../../shared/lib/permissions";
import { getUserRoles } from "../../shared/lib/user-roles";
import {
  canEditEquipment,
  canReadEquipment,
  canDownloadEquipmentDocuments,
  canManageEquipmentDocuments,
} from "../equipment-permissions/equipment-permissions";
import { canAccessWorkspaceRoute } from "../../lib/role-navigation";
import { canManageUsers } from "../../shared/lib/roles";
import {
  canBackdatePpeIssue,
  canIssuePpe,
  canManageEmployeeSizes,
  canManagePpeCatalog,
  canManagePpeNorms,
  canReadPpe,
} from "../ppe-permissions/ppe-permissions";

export type ProfileModuleAccess = {
  description: string;
  title: string;
};

export type ProfilePermissionAccess = {
  allowed: boolean;
  description: string;
  title: string;
};

const roleLabels: Record<string, string> = {
  admin: "Админ",
  auditor: "Аудитор",
  ppe_specialist: "Специалист по охране труда",
  accounting_specialist: "Специалист по учёту",
  storekeeper: "Кладовщик",
  chief_engineer: "Главный инженер",
  engineer: "Инженер",
  operator: "Оператор",
};

const baseModules: (ProfileModuleAccess & { route: string })[] = [
  {
    title: "Панель",
    route: "#/dashboard",
    description: "Просмотр общей рабочей области.",
  },
  {
    title: "Оборудование",
    route: "#/equipment",
    description: "Просмотр карточек и истории оборудования.",
  },
  {
    title: "Поиск",
    route: "#/search",
    description: "Поиск оборудования по общему индексу.",
  },
  {
    title: "Профиль",
    route: "#/profile",
    description: "Просмотр собственных данных и доступов.",
  },
];

const equipmentEditorModules: (ProfileModuleAccess & { permission: string })[] = [
  {
    title: "Редактирование оборудования",
    permission: "equipment.edit",
    description: "Создание и изменение карточек оборудования.",
  },
  {
    title: "Документы оборудования",
    permission: "files.manage",
    description: "Загрузка и удаление документов оборудования.",
  },
];

const adminModules: (ProfileModuleAccess & { permission: string })[] = [
  {
    title: "Пользователи",
    permission: "users.manage",
    description: "Управление сотрудниками и учётными записями.",
  },
  {
    title: "Справочники",
    permission: "dictionaries.manage",
    description: "Управление справочниками системы.",
  },
];

export function getProfileRoleLabel(role: string | null | undefined) {
  if (!role) {
    return "Не указана";
  }

  const roles = getUserRoles(role);
  return roles.length ? roles.map((value) => roleLabels[value]).join(", ") : role;
}

export function getProfileModuleAccess(permissions: readonly string[] | null | undefined) {
  const modules: ProfileModuleAccess[] = baseModules
    .filter((module) => canAccessWorkspaceRoute(permissions, module.route))
    .map(({ title, description }) => ({ title, description }));
  if (canManageEmployeeSizes(permissions) && !canManageUsers(permissions))
    modules.push({
      title: "Сотрудники",
      description: "Просмотр сотрудников и изменение размеров для СИЗ.",
    });

  modules.push(
    ...[...equipmentEditorModules, ...adminModules]
      .filter((module) => module.permission === "files.manage"
        ? canManageEquipmentDocuments(permissions)
        : hasPermission(permissions, module.permission))
      .map(({ title, description }) => ({ title, description })),
  );

  if (canReadPpe(permissions)) {
    modules.push({
      title: "СИЗ",
      description: "Работа со средствами индивидуальной защиты.",
    });
  }

  const catalogManageable = hasPermission(permissions, "warehouse.catalog.manage");
  const adjustmentsManageable = hasPermission(permissions, "warehouse.adjustments.manage");
  if (catalogManageable || adjustmentsManageable) {
    modules.push({
      title: "Склад",
      description: adjustmentsManageable
        ? catalogManageable
          ? "Управление номенклатурой и корректировка складских остатков."
          : "Административная корректировка складских остатков."
        : "Управление складской номенклатурой.",
    });
  }

  return modules;
}

export function getProfilePermissionAccess(permissions: readonly string[] | null | undefined) {
  const usersManageable = canManageUsers(permissions);
  const equipmentEditable = canEditEquipment(permissions);

  return [
    {
      allowed: hasPermission(permissions, "warehouse.adjustments.manage"),
      title: "Корректировка складских остатков",
      description: "Административное списание и оприходование излишков с обязательными документами и аудитом.",
    },
    {
      allowed: hasPermission(permissions, "warehouse.catalog.manage"),
      title: "Управление складской номенклатурой",
      description: "Просмотр, создание, изменение и активация или деактивация складских позиций.",
    },
    {
      allowed: canReadEquipment(permissions),
      title: "Просмотр оборудования",
      description:
        "Карточки и история изменений доступны для просмотра.",
    },
    {
      allowed: canDownloadEquipmentDocuments(permissions),
      title: "Скачивание документов",
      description: "Документы оборудования доступны для скачивания.",
    },
    {
      allowed: equipmentEditable,
      title: "Редактирование оборудования",
      description: "Создание и изменение карточек оборудования.",
    },
    {
      allowed: canManageEquipmentDocuments(permissions),
      title: "Управление документами",
      description: "Загрузка и удаление документов оборудования.",
    },
    {
      allowed: usersManageable,
      title: "Управление пользователями",
      description: "Создание сотрудников, учётных записей и изменение ролей.",
    },
    {
      allowed: hasPermission(permissions, "dictionaries.manage"),
      title: "Управление справочниками",
      description: "Создание и редактирование справочников системы.",
    },
    {
      allowed: canReadPpe(permissions),
      title: "Чтение СИЗ",
      description:
        "Просмотр каталога СИЗ, сотрудников и должностей в рамках модуля СИЗ.",
    },
    {
      allowed: canManagePpeCatalog(permissions),
      title: "Управление каталогом СИЗ",
      description:
        "Создание, изменение и удаление позиций СИЗ и их размеров.",
    },
    {
      allowed: canManagePpeNorms(permissions),
      title: "Управление нормами СИЗ",
      description:
        "Создание и изменение редакций норм, завершение их действия.",
    },
    {
      allowed: canIssuePpe(permissions),
      title: "Выдача СИЗ",
      description: "Нормативная и дополнительная выдача СИЗ сотрудникам.",
    },
    ...(canBackdatePpeIssue(permissions)
      ? [
          {
            allowed: canBackdatePpeIssue(permissions),
            title: "Выдача СИЗ задним числом",
            description: "Оформление выдачи СИЗ за прошедшую дату.",
          },
        ]
      : []),
    {
      allowed: canManageEmployeeSizes(permissions),
      title: "Изменение размеров сотрудников",
      description:
        "Изменение размеров одежды, обуви, перчаток и головных уборов для СИЗ.",
    },
  ];
}
