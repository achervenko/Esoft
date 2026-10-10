import {
  BookCheck,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Factory,
  Gauge,
  ListChecks,
  Settings,
  Search,
  Users,
  HardHat,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type SidebarLinkItem = {
  href: string;
  icon: LucideIcon;
  label: string;
  roles?: string[];
  type?: "link";
};

export type SidebarGroupItem = {
  icon: LucideIcon;
  id: string;
  items: SidebarLinkItem[];
  label: string;
  type: "group";
};

export type SidebarItem = SidebarGroupItem | SidebarLinkItem;

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
        href: "#/search",
        icon: Search,
        label: "Поиск",
      },
      {
        href: "#/equipment",
        icon: Factory,
        label: "Оборудование",
      },
      {
        href: "#/ppe",
        icon: HardHat,
        label: "СИЗ",
        roles: ["admin", "ppe_specialist", "accounting_specialist"],
      },
      {
        href: "#/calendar",
        icon: CalendarDays,
        label: "Календарь",
        roles: ["admin", "chief_engineer", "engineer"],
      },
      {
        icon: ListChecks,
        id: "checklists",
        label: "Чек-листы",
        type: "group",
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
        icon: Settings,
        id: "administration",
        label: "Администрирование",
        type: "group",
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
          {
            href: "#/dictionaries",
            icon: Users,
            label: "Сотрудники",
            roles: ["ppe_specialist"],
          },
          {
            href: "#/production-calendar",
            icon: CalendarDays,
            label: "Производственный",
            roles: ["admin"],
          },
        ],
      },
    ],
  },
];
