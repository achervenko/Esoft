import { BookCheck, BookOpen, ClipboardList, Factory, Gauge, Search, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type SidebarItem = {
  href: string;
  icon: LucideIcon;
  label: string;
  roles?: string[];
};

export type SidebarSection = {
  items: SidebarItem[];
  title: string;
};

export const sidebarSections: SidebarSection[] = [
  {
    title: "Основное",
    items: [
      {
        href: "#/dashboard",
        icon: Gauge,
        label: "Панель",
      },
      {
        href: "#/equipment",
        icon: Factory,
        label: "Оборудование",
      },
      {
        href: "#/search",
        icon: Search,
        label: "Поиск",
      },
    ],
  },
  {
    title: "Чек-листы",
    items: [
      {
        href: "#/my-checklists",
        icon: ClipboardList,
        label: "Мои чек-листы",
      },
      {
        href: "#/checklist-admin",
        icon: BookCheck,
        label: "Редактор чек-листов",
        roles: ["admin", "chief_engineer"],
      },
    ],
  },
  {
    title: "Администрирование",
    items: [
      {
        href: "#/users",
        icon: Users,
        label: "Пользователи",
        roles: ["admin"],
      },
      {
        href: "#/dictionaries",
        icon: BookOpen,
        label: "Справочники",
        roles: ["admin"],
      },
    ],
  },
];
