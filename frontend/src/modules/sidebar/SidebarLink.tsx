import { ChevronRight } from "lucide-react";
import type { SidebarLinkItem } from "./sidebarItems";
import { isSidebarItemActive } from "./sidebar-navigation";
import "./sidebar-navigation.css";

export type SidebarLinkProps = {
  activeHref: string;
  isNavigable?: boolean;
  item: SidebarLinkItem;
  onNavigate: () => void;
  subItem?: boolean;
};

export function SidebarLink({
  activeHref,
  isNavigable = true,
  item,
  onNavigate,
  subItem = false,
}: SidebarLinkProps) {
  const Icon = item.icon;
  const isActive = isSidebarItemActive(activeHref, item.href);

  return (
    <a
      aria-current={isActive ? "page" : undefined}
      className={`${subItem ? "sidebar-sub-link" : "sidebar-link"}${
        isActive ? " active" : ""
      }`}
      href={item.href}
      onClick={onNavigate}
      tabIndex={isNavigable ? undefined : -1}
      title={item.label}
    >
      <Icon aria-hidden="true" size={20} strokeWidth={1.9} />
      <span className="sidebar-link-text">{item.label}</span>
      {isActive ? (
        <ChevronRight aria-hidden="true" className="active-arrow" size={16} />
      ) : null}
    </a>
  );
}
