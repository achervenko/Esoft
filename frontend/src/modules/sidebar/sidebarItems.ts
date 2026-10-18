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
  permission?: string;
  excludePermission?: string;
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
      },
      {
        href: "#/calendar",
        icon: CalendarDays,
        label: "Календарь",
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
          },
          {
            href: "#/dictionaries",
            icon: BookOpen,
            label: "Справочники",
            permission: "dictionaries.manage",
          },
          {
            href: "#/dictionaries",
            icon: Users,
            label: "Сотрудники",
            permission: "ppe.employee-sizes.manage",
            excludePermission: "dictionaries.manage",
          },
          {
            href: "#/production-calendar",
            icon: CalendarDays,
            label: "Производственный",
          },
        ],
      },
    ],
  },
];
