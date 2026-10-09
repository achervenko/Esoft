import {
  canEditEquipment,
  canReadEquipment,
  canDownloadEquipmentDocuments,
} from "../equipment-permissions/equipment-permissions";
import { canAccessWorkspaceRoute } from "../../lib/role-navigation";
import { isAdministrator } from "../../shared/lib/roles";
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
  chief_engineer: "Главный инженер",
  engineer: "Инженер",
  operator: "Оператор",
};

const baseModules: ProfileModuleAccess[] = [
  {
    title: "Панель",
    description: "Просмотр общей рабочей области.",
  },
  {
    title: "Оборудование",
    description: "Просмотр карточек, документов и истории оборудования.",
  },
  {
    title: "Поиск",
    description: "Поиск оборудования по общему индексу.",
  },
  {
    title: "Профиль",
    description: "Просмотр собственных данных и доступов.",
  },
];

const equipmentEditorModules: ProfileModuleAccess[] = [
  {
    title: "Редактирование оборудования",
    description: "Создание и изменение карточек оборудования.",
  },
  {
    title: "Документы оборудования",
    description: "Загрузка и удаление документов оборудования.",
  },
];

const adminModules: ProfileModuleAccess[] = [
  {
    title: "Пользователи",
    description: "Управление сотрудниками и учётными записями.",
  },
  {
    title: "Справочники",
    description: "Управление справочниками системы.",
  },
];

export function getProfileRoleLabel(role: string | null | undefined) {
  if (!role) {
    return "Не указана";
  }

  return roleLabels[role] ?? role;
}

export function getProfileModuleAccess(role: string | null | undefined) {
  const moduleRoutes: Record<string, string> = {
    Панель: "#/dashboard",
    Оборудование: "#/equipment",
    Поиск: "#/search",
    Профиль: "#/profile",
  };
  const modules = baseModules.filter((module) =>
    canAccessWorkspaceRoute(role, moduleRoutes[module.title]),
  );
  if (canManageEmployeeSizes(role) && !isAdministrator(role))
    modules.push({
      title: "Сотрудники",
      description: "Просмотр сотрудников и изменение размеров для СИЗ.",
    });

  if (canEditEquipment(role)) {
    modules.push(...equipmentEditorModules);
  }

  if (isAdministrator(role)) {
    modules.push(...adminModules);
  }

  if (canReadPpe(role)) {
    modules.push({
      title: "СИЗ",
      description: "Работа со средствами индивидуальной защиты.",
    });
  }

  return modules;
}

export function getProfilePermissionAccess(role: string | null | undefined) {
  const isAdmin = isAdministrator(role);
  const equipmentEditable = canEditEquipment(role);

  return [
    {
      allowed: canReadEquipment(role),
      title: "Просмотр оборудования",
      description:
        "Карточки, документы и история изменений доступны для просмотра.",
    },
    {
      allowed: canDownloadEquipmentDocuments(role),
      title: "Скачивание документов",
      description: "Документы оборудования доступны для скачивания.",
    },
    {
      allowed: equipmentEditable,
      title: "Редактирование оборудования",
      description: "Создание и изменение карточек оборудования.",
    },
    {
      allowed: equipmentEditable,
      title: "Управление документами",
      description: "Загрузка и удаление документов оборудования.",
    },
    {
      allowed: isAdmin,
      title: "Управление пользователями",
      description: "Создание сотрудников, учётных записей и изменение ролей.",
    },
    {
      allowed: isAdmin,
      title: "Управление справочниками",
      description: "Создание и редактирование справочников системы.",
    },
    {
      allowed: canReadPpe(role),
      title: "Чтение СИЗ",
      description:
        "Просмотр каталога СИЗ, сотрудников и должностей в рамках модуля СИЗ.",
    },
    {
      allowed: canManagePpeCatalog(role),
      title: "Управление каталогом СИЗ",
      description:
        "Создание, изменение и отключение позиций СИЗ и их размеров.",
    },
    {
      allowed: canManagePpeNorms(role),
      title: "Управление нормами СИЗ",
      description:
        "Создание и изменение редакций норм, завершение их действия.",
    },
    {
      allowed: canIssuePpe(role),
      title: "Выдача СИЗ",
      description: "Нормативная и дополнительная выдача СИЗ сотрудникам.",
    },
    ...(isAdmin
      ? [
          {
            allowed: canBackdatePpeIssue(role),
            title: "Выдача СИЗ задним числом",
            description: "Оформление выдачи СИЗ за прошедшую дату.",
          },
        ]
      : []),
    {
      allowed: canManageEmployeeSizes(role),
      title: "Изменение размеров сотрудников",
      description:
        "Изменение размеров одежды, обуви, перчаток и головных уборов для СИЗ.",
    },
  ];
}
