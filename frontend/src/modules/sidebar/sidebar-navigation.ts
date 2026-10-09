import { canAccessWorkspaceRoute } from "../../lib/role-navigation";
import {
  sidebarSections,
  type SidebarItem,
  type SidebarLinkItem,
} from "./sidebarItems";

export function isSidebarItemActive(activeHref: string, itemHref: string) {
  return (
    activeHref === itemHref ||
    activeHref.startsWith(`${itemHref}?`) ||
    activeHref.startsWith(`${itemHref}/`)
  );
}

const MIN_VISIBLE_ITEMS_FOR_COLLAPSIBLE_GROUP = 2;

export function canShowSidebarItem(
  item: SidebarLinkItem,
  userRole: string | null,
) {
  return (
    canAccessWorkspaceRoute(userRole, item.href) &&
    (!item.roles || item.roles.includes(String(userRole)))
  );
}

export function getVisibleSidebarItems(
  items: SidebarItem[],
  userRole: string | null,
) {
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

      if (visibleGroupItems.length < MIN_VISIBLE_ITEMS_FOR_COLLAPSIBLE_GROUP) {
        return visibleGroupItems[0];
      }

      return {
        ...item,
        items: visibleGroupItems,
      };
    })
    .filter((item): item is SidebarItem => item !== null);
}

export function getActiveSidebarGroupId(
  activeHref: string,
  userRole: string | null,
) {
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
