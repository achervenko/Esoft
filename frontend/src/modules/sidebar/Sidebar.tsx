import { ChevronRight, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DEFAULT_AUTH_ROUTE, getHashRoute } from '../../lib/hash-router';
import type { EmployeeProfile, UserPhoto } from '../../shared/api/user-profile-api';
import { sidebarSections } from './sidebarItems';
import { useMobileSidebar } from './useMobileSidebar';
import './Sidebar.css';

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

function getUserDisplayName(user: SidebarProps['user']) {
  if (!user) {
    return 'Пользователь';
  }

  return (
    user.employee?.displayName ||
    user.displayUsername ||
    user.username ||
    user.name ||
    'Пользователь'
  );
}

function getUserInitial(displayName: string) {
  return displayName.trim().charAt(0).toUpperCase() || 'П';
}

function getAccountLabel(user: SidebarProps['user']) {
  return user?.username || user?.displayUsername || user?.name || 'admin';
}

function isSidebarItemActive(activeHref: string, itemHref: string) {
  return activeHref === itemHref || activeHref.startsWith(`${itemHref}?`);
}

export function Sidebar({ onLogout, user }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [activeHref, setActiveHref] = useState(getHashRoute() || DEFAULT_AUTH_ROUTE);
  const isMobileSidebar = useMobileSidebar();
  const displayName = getUserDisplayName(user);
  const username = getAccountLabel(user);
  const userRole = user?.role ?? null;

  useEffect(() => {
    const handleHashChange = () => setActiveHref(getHashRoute());

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

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

  return (
    <aside
      className={`app-sidebar${isCollapsed ? ' app-sidebar-collapsed' : ''}${
        isMobileOpen ? ' app-sidebar-mobile-open' : ''
      }`}
    >
      <div className="sidebar-header">
        <a className="sidebar-brand" href="#/dashboard" onClick={closeMobileSidebar}>
          <span className="sidebar-brand-mark">
            <img alt="" aria-hidden="true" src="/favicon.svg" />
          </span>
          <span className="sidebar-brand-text">Esoft</span>
        </a>

        <button
          aria-label={isCollapsed ? 'Развернуть меню' : 'Свернуть меню'}
          className="sidebar-icon-button"
          onClick={handleToggleSidebar}
          title={isCollapsed ? 'Развернуть меню' : 'Свернуть меню'}
          type="button"
        >
          {isCollapsed || (isMobileSidebar && !isMobileOpen) ? (
            <PanelLeftOpen size={20} />
          ) : (
            <PanelLeftClose size={20} />
          )}
        </button>
      </div>

      <nav className="sidebar-nav" aria-label="Основное меню">
        {sidebarSections.map((section) => (
          <section className="sidebar-section" key={section.title}>
            <h2>{section.title}</h2>
            <ul>
              {section.items
                .filter((item) => !item.roles || item.roles.includes(String(userRole)))
                .map((item) => {
                const Icon = item.icon;
                const isActive = isSidebarItemActive(activeHref, item.href);

                return (
                  <li key={item.href}>
                    <a
                      aria-current={isActive ? 'page' : undefined}
                      className={isActive ? 'active' : undefined}
                      href={item.href}
                      onClick={closeMobileSidebar}
                      title={item.label}
                    >
                      <Icon aria-hidden="true" size={20} strokeWidth={1.9} />
                      <span className="sidebar-link-text">{item.label}</span>
                      {isActive ? (
                        <ChevronRight
                          aria-hidden="true"
                          className="active-arrow"
                          size={16}
                        />
                      ) : null}
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
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
              <img alt="" src={user.photo.smallUrl} />
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
