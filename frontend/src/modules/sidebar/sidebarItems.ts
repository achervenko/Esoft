import { Factory, Gauge, Users } from 'lucide-react';
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
