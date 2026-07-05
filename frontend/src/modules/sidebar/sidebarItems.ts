import {
  ClipboardList,
  Factory,
  FileClock,
  Gauge,
  History,
  Users,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type SidebarItem = {
  href: string;
  icon: LucideIcon;
  label: string;
};

export type SidebarSection = {
  items: SidebarItem[];
  title: string;
};

export const sidebarSections: SidebarSection[] = [
  {
    title: 'Основное',
    items: [
      {
        href: '#/dashboard',
        icon: Gauge,
        label: 'Панель',
      },
      {
        href: '#/equipment',
        icon: Factory,
        label: 'Оборудование',
      },
      {
        href: '#/repairs',
        icon: Wrench,
        label: 'Ремонты',
      },
      {
        href: '#/audits',
        icon: ClipboardList,
        label: 'ППО/ППР',
      },
    ],
  },
  {
    title: 'Журналы',
    items: [
      {
        href: '#/equipment-history',
        icon: History,
        label: 'История оборудования',
      },
      {
        href: '#/audit-log',
        icon: FileClock,
        label: 'Журнал аудита',
      },
    ],
  },
  {
    title: 'Администрирование',
    items: [
      {
        href: '#/users',
        icon: Users,
        label: 'Пользователи',
      },
    ],
  },
];
