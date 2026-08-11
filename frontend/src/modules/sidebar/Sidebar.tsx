import {
  ChevronRight,
  type LucideIcon,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useEffect, useState } from "react";
import { DEFAULT_AUTH_ROUTE, getHashRoute } from "../../lib/hash-router";
import type {
  EmployeeProfile,
  UserPhoto,
} from "../../shared/api/user-profile-api";
import { AsyncImage } from "../../shared/ui/AsyncImage";
import { sidebarSections } from "./sidebarItems";
import type { SidebarGroupItem, SidebarItem, SidebarLinkItem } from "./sidebarItems";
import { useMobileSidebar } from "./useMobileSidebar";
import "./Sidebar.css";

type SidebarProps = {
  onLogout: () => void;
  user: {
    displayUsername?: string | null;
    employee?: EmployeeProfile | null;
    name?: string | null;
    photo?: UserPhoto | null;
    role?: string | null;
    username?: string | null;
  } | null;
};

function getUserDisplayName(user: SidebarProps["user"]) {
  if (!user) {
    return "Пользователь";
  }

  return (
    user.employee?.displayName ||
    user.displayUsername ||
    user.username ||
    user.name ||
    "Пользователь"
  );
}

function getUserInitial(displayName: string) {
  return displayName.trim().charAt(0).toUpperCase() || "П";
}

function getAccountLabel(user: SidebarProps["user"]) {
  return user?.username || user?.displayUsername || user?.name || "admin";
}

function isSidebarItemActive(activeHref: string, itemHref: string) {
  return (
    activeHref === itemHref ||
    activeHref.startsWith(`${itemHref}?`) ||
    activeHref.startsWith(`${itemHref}/`)
  );
}

const MIN_VISIBLE_ITEMS_FOR_COLLAPSIBLE_GROUP = 2;

function canShowSidebarItem(item: SidebarLinkItem, userRole: string | null) {
  return !item.roles || item.roles.includes(String(userRole));
}

function getVisibleSidebarItems(items: SidebarItem[], userRole: string | null) {
  return items
    .map((item) => {
      if (item.type !== "group") {
        return canShowSidebarItem(item, userRole) ? item : null;
      }

      const visibleGroupItems = item.items.filter((child) =>
        canShowSidebarItem(child, userRole),
      );

      if (visibleGroupItems.length === 0) {
        return null;
      }

      if (
        visibleGroupItems.length < MIN_VISIBLE_ITEMS_FOR_COLLAPSIBLE_GROUP
      ) {
        return visibleGroupItems[0];
      }

      return {
        ...item,
        items: visibleGroupItems,
      };
    })
    .filter((item): item is SidebarItem => item !== null);
}

function getActiveSidebarGroupId(activeHref: string, userRole: string | null) {
  for (const section of sidebarSections) {
    const visibleItems = getVisibleSidebarItems(section.items, userRole);

    for (const item of visibleItems) {
      if (
        item.type === "group" &&
        item.items.some((child) => isSidebarItemActive(activeHref, child.href))
      ) {
        return item.id;
      }
    }
  }

  return null;
}

type SidebarLinkProps = {
  activeHref: string;
  isNavigable?: boolean;
  item: SidebarLinkItem;
  onNavigate: () => void;
  subItem?: boolean;
};

function SidebarLink({
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

type SidebarCollapsibleGroupProps = {
  activeHref: string;
  group: SidebarGroupItem;
  isOpen: boolean;
  onNavigate: () => void;
  onOpenChange: (isOpen: boolean) => void;
};

function SidebarCollapsibleGroup({
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

export function Sidebar({ onLogout, user }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [activeHref, setActiveHref] = useState(
    getHashRoute() || DEFAULT_AUTH_ROUTE,
  );
  const isMobileSidebar = useMobileSidebar();
  const displayName = getUserDisplayName(user);
  const username = getAccountLabel(user);
  const userRole = user?.role ?? null;
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const activeGroupId = getActiveSidebarGroupId(
      getHashRoute() || DEFAULT_AUTH_ROUTE,
      userRole,
    );

    return activeGroupId ? { [activeGroupId]: true } : {};
  });
  const [lastActiveGroupId, setLastActiveGroupId] = useState<string | null>(
    () =>
      getActiveSidebarGroupId(getHashRoute() || DEFAULT_AUTH_ROUTE, userRole),
  );

  useEffect(() => {
    const handleHashChange = () => setActiveHref(getHashRoute());

    window.addEventListener("hashchange", handleHashChange);
    handleHashChange();

    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    const activeGroupId = getActiveSidebarGroupId(activeHref, userRole);

    if (activeGroupId === lastActiveGroupId) {
      return;
    }

    if (activeGroupId) {
      setOpenGroups((current) => ({
        ...current,
        [activeGroupId]: true,
      }));
    }

    setLastActiveGroupId(activeGroupId);
  }, [activeHref, lastActiveGroupId, userRole]);

  const handleToggleSidebar = () => {
    if (isMobileSidebar) {
      setIsMobileOpen((value) => !value);
      return;
    }

    setIsCollapsed((value) => !value);
  };

  const closeMobileSidebar = () => {
    if (isMobileSidebar) {
      setIsMobileOpen(false);
    }
  };
  const isSidebarOpen = isMobileSidebar ? isMobileOpen : !isCollapsed;
  const toggleLabel = isSidebarOpen
    ? "Свернуть меню"
    : "Развернуть меню";

  return (
    <aside
      className={`app-sidebar${isCollapsed ? " app-sidebar-collapsed" : ""}${
        isMobileOpen ? " app-sidebar-mobile-open" : ""
      }`}
    >
      <div className="sidebar-header">
        <a
          className="sidebar-brand"
          href="#/dashboard"
          onClick={closeMobileSidebar}
        >
          <span className="sidebar-brand-mark">
            <img alt="" aria-hidden="true" src="/favicon.svg" />
          </span>
          <span className="sidebar-brand-text">Esoft</span>
        </a>

        <button
          aria-label={toggleLabel}
          className="sidebar-icon-button"
          onClick={handleToggleSidebar}
          title={toggleLabel}
          type="button"
        >
          {isSidebarOpen ? (
            <PanelLeftClose size={20} />
          ) : (
            <PanelLeftOpen size={20} />
          )}
        </button>
      </div>

      <nav className="sidebar-nav" aria-label="Основное меню">
        {sidebarSections.map((section) => {
          const visibleItems = getVisibleSidebarItems(section.items, userRole);

          if (visibleItems.length === 0) {
            return null;
          }

          return (
            <section className="sidebar-section" key={section.title}>
              <h2>{section.title}</h2>
              <ul>
                {visibleItems.map((item) => {
                  if (item.type === "group") {
                    return (
                      <SidebarCollapsibleGroup
                        activeHref={activeHref}
                        group={item}
                        isOpen={Boolean(openGroups[item.id])}
                        key={item.id}
                        onNavigate={closeMobileSidebar}
                        onOpenChange={(isOpen) =>
                          setOpenGroups((current) => ({
                            ...current,
                            [item.id]: isOpen,
                          }))
                        }
                      />
                    );
                  }

                  return (
                    <li key={item.href}>
                      <SidebarLink
                        activeHref={activeHref}
                        item={item}
                        onNavigate={closeMobileSidebar}
                      />
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <a
          className="sidebar-user"
          href="#/profile"
          onClick={closeMobileSidebar}
          title="Настройки пользователя"
        >
          <span className="sidebar-user-avatar">
            {user?.photo?.smallUrl ? (
              <AsyncImage src={user.photo.smallUrl} />
            ) : (
              getUserInitial(displayName)
            )}
          </span>
          <span className="sidebar-user-info">
            <strong>{displayName}</strong>
            <span>{username}</span>
          </span>
        </a>

        <button className="sidebar-logout" onClick={onLogout} type="button">
          <LogOut aria-hidden="true" size={19} />
          <span className="sidebar-logout-text">Выйти</span>
        </button>
      </div>
    </aside>
  );
}
