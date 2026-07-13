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
  const modules = [...baseModules];

  if (role === "admin" || role === "chief_engineer" || role === "engineer") {
    modules.push(...equipmentEditorModules);
  }

  if (role === "admin") {
    modules.push(...adminModules);
  }

  return modules;
}

export function getProfilePermissionAccess(role: string | null | undefined) {
  const isAdmin = role === "admin";
  const canEditEquipment =
    role === "admin" || role === "chief_engineer" || role === "engineer";

  return [
    {
      allowed: true,
      title: "Просмотр оборудования",
      description: "Карточки, документы и история изменений доступны для просмотра.",
    },
    {
      allowed: true,
      title: "Скачивание документов",
      description: "Документы оборудования доступны для скачивания.",
    },
    {
      allowed: canEditEquipment,
      title: "Редактирование оборудования",
      description: "Создание и изменение карточек оборудования.",
    },
    {
      allowed: canEditEquipment,
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
  ];
}
