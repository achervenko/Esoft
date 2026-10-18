import { hasPermission } from "../../shared/lib/permissions";
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
  userPermissions: readonly string[] | null,
) {
  return (
    canAccessWorkspaceRoute(userPermissions, item.href) &&
    (!item.permission || hasPermission(userPermissions, item.permission)) &&
    (!item.excludePermission || !hasPermission(userPermissions, item.excludePermission))
  );
}

export function getVisibleSidebarItems(
  items: SidebarItem[],
  userPermissions: readonly string[] | null,
) {
  return items
    .map((item) => {
      if (item.type !== "group") {
        return canShowSidebarItem(item, userPermissions) ? item : null;
      }

      const visibleGroupItems = item.items.filter((child) =>
        canShowSidebarItem(child, userPermissions),
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
  userPermissions: readonly string[] | null,
) {
  for (const section of sidebarSections) {
    const visibleItems = getVisibleSidebarItems(section.items, userPermissions);

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
