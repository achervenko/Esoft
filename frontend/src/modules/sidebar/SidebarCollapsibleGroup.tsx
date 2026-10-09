import { ChevronRight, type LucideIcon } from "lucide-react";
import type { SidebarGroupItem } from "./sidebarItems";
import { isSidebarItemActive } from "./sidebar-navigation";
import { SidebarLink } from "./SidebarLink";
import "./sidebar-navigation.css";

export type SidebarCollapsibleGroupProps = {
  activeHref: string;
  group: SidebarGroupItem;
  isOpen: boolean;
  onNavigate: () => void;
  onOpenChange: (isOpen: boolean) => void;
};

export function SidebarCollapsibleGroup({
  activeHref,
  group,
  isOpen,
  onNavigate,
  onOpenChange,
}: SidebarCollapsibleGroupProps) {
  const Icon: LucideIcon = group.icon;
  const hasActiveChild = group.items.some((item) =>
    isSidebarItemActive(activeHref, item.href),
  );
  const contentId = `sidebar-group-${group.id}`;

  return (
    <li className="sidebar-collapsible-item">
      <button
        aria-controls={contentId}
        aria-expanded={isOpen}
        className={`sidebar-collapsible-trigger${
          hasActiveChild ? " contains-active" : ""
        }`}
        onClick={() => onOpenChange(!isOpen)}
        title={group.label}
        type="button"
      >
        <Icon aria-hidden="true" size={20} strokeWidth={1.9} />
        <span className="sidebar-link-text">{group.label}</span>
        <ChevronRight
          aria-hidden="true"
          className="sidebar-collapsible-chevron"
          size={16}
        />
      </button>
      <div
        aria-hidden={!isOpen}
        className="sidebar-collapsible-content"
        data-state={isOpen ? "open" : "closed"}
        id={contentId}
      >
        <ul className="sidebar-sub-menu">
          {group.items.map((item) => (
            <li key={item.href}>
              <SidebarLink
                activeHref={activeHref}
                isNavigable={isOpen}
                item={item}
                onNavigate={onNavigate}
                subItem
              />
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}
