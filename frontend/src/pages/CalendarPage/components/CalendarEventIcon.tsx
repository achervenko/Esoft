import {
  CalendarCheck,
  ClipboardList,
  Factory,
  FileText,
  UserRound,
  Wrench,
} from "lucide-react";

type CalendarEventIconProps = {
  icon?: string | null;
  size: number;
  strokeWidth: number;
};

const CALENDAR_EVENT_ICONS = {
  calendar: CalendarCheck,
  checklist: ClipboardList,
  document: FileText,
  factory: Factory,
  tool: Wrench,
  user: UserRound,
} as const;

export function CalendarEventIcon({
  icon,
  size,
  strokeWidth,
}: CalendarEventIconProps) {
  const Icon = getIcon(icon);

  return <Icon size={size} strokeWidth={strokeWidth} />;
}

function getIcon(icon: string | null | undefined) {
  if (icon && icon in CALENDAR_EVENT_ICONS) {
    return CALENDAR_EVENT_ICONS[icon as keyof typeof CALENDAR_EVENT_ICONS];
  }

  return CalendarCheck;
}
