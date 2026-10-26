import { LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { DEFAULT_AUTH_ROUTE, getHashRoute } from "../../lib/hash-router";
import { getDefaultAuthRoute } from "../../lib/role-navigation";
import type {
  EmployeeProfile,
  UserPhoto,
} from "../../shared/api/user-profile-api";
import { AsyncImage } from "../../shared/ui/AsyncImage";
import { sidebarSections } from "./sidebarItems";
import { SidebarLink } from "./SidebarLink";
import { SidebarCollapsibleGroup } from "./SidebarCollapsibleGroup";
import {
  getVisibleSidebarItems,
  getActiveSidebarGroupId,
} from "./sidebar-navigation";
import { useMediaQuery } from "../../shared/lib/useMediaQuery";
import "./Sidebar.css";

type SidebarProps = {
  onLogout: () => void;
  user: {
    displayUsername?: string | null;
    employee?: EmployeeProfile | null;
    name?: string | null;
    photo?: UserPhoto | null;
    role?: string | null;
    permissions?: readonly string[];
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
  return (
    user?.username || user?.displayUsername || user?.name || "Пользователь"
  );
}

export function Sidebar({ onLogout, user }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [activeHref, setActiveHref] = useState(
    getHashRoute() || DEFAULT_AUTH_ROUTE,
  );
  const isMobileSidebar = useMediaQuery("(max-width: 760px)");
  const displayName = getUserDisplayName(user);
  const username = getAccountLabel(user);
  const userPermissions = user?.permissions ?? null;
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const activeGroupId = getActiveSidebarGroupId(
      getHashRoute() || DEFAULT_AUTH_ROUTE,
      userPermissions,
    );

    return activeGroupId ? { [activeGroupId]: true } : {};
  });
  const [lastActiveGroupId, setLastActiveGroupId] = useState<string | null>(
    () =>
      getActiveSidebarGroupId(
        getHashRoute() || DEFAULT_AUTH_ROUTE,
        userPermissions,
      ),
  );

  useEffect(() => {
    const handleHashChange = () => setActiveHref(getHashRoute());

    window.addEventListener("hashchange", handleHashChange);
    handleHashChange();

    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    const activeGroupId = getActiveSidebarGroupId(activeHref, userPermissions);

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
  }, [activeHref, lastActiveGroupId, userPermissions]);

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
  const toggleLabel = isSidebarOpen ? "Свернуть меню" : "Развернуть меню";

  return (
    <aside
      className={`app-sidebar${isCollapsed ? " app-sidebar-collapsed" : ""}${
        isMobileOpen ? " app-sidebar-mobile-open" : ""
      }`}
    >
      <div className="sidebar-header">
        <a
          className="sidebar-brand"
          href={getDefaultAuthRoute(userPermissions)}
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
          const visibleItems = getVisibleSidebarItems(
            section.items,
            userPermissions,
          );

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
                        onOpenChange={(isOpen) => {
                          if (isCollapsed && !isMobileSidebar) {
                            setIsCollapsed(false);
                            isOpen = true;
                          }
                          setOpenGroups((current) => ({
                            ...current,
                            [item.id]: isOpen,
                          }));
                        }}
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
