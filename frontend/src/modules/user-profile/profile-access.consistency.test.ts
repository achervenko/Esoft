import { permissionsForTest } from "../../test/permission-fixtures";
import { describe, expect, it } from "vitest";
import { canAccessWorkspaceRoute } from "../../lib/role-navigation";
import { getVisibleSidebarItems } from "../sidebar/sidebar-navigation";
import { sidebarSections } from "../sidebar/sidebarItems";
import {
  getProfileModuleAccess,
  getProfilePermissionAccess,
} from "./profile-access";

describe("shared access policy", () => {
  it.each([
    "admin",
    "chief_engineer",
    "engineer",
    "operator",
    "auditor",
    "ppe_specialist",
    "accounting_specialist",
    "storekeeper",
    "unknown",
    null,
  ])("keeps profile, navigation and route access consistent for %s", (role) => {
    const modules = getProfileModuleAccess(permissionsForTest(role));
    const permissions = getProfilePermissionAccess(permissionsForTest(role));
    for (const [title, route] of [
      ["Оборудование", "#/equipment"],
      ["СИЗ", "#/ppe"],
    ]) {
      expect(modules.some((module) => module.title === title)).toBe(
        canAccessWorkspaceRoute(permissionsForTest(role), route),
      );
    }
    expect(
      permissions.find(
        (permission) => permission.title === "Просмотр оборудования",
      )?.allowed,
    ).toBe(canAccessWorkspaceRoute(permissionsForTest(role), "#/equipment"));
    const links = sidebarSections
      .flatMap((section) => getVisibleSidebarItems(section.items,permissionsForTest(role)))
      .flatMap((item) => (item.type === "group" ? item.items : [item]));
    for (const link of links)
      expect(canAccessWorkspaceRoute(permissionsForTest(role), link.href)).toBe(true);
    expect(links.some((link) => link.href === "#/ppe")).toBe(
      canAccessWorkspaceRoute(permissionsForTest(role), "#/ppe"),
    );
  });
  it.each(["unknown", null, undefined])(
    "does not grant equipment or administrative permissions to %s",
    (role) => {
      expect(
        getProfilePermissionAccess(permissionsForTest(role)).every(
          (permission) => !permission.allowed,
        ),
      ).toBe(true);
      expect(
        getProfileModuleAccess(permissionsForTest(role)).map((module) => module.title),
      ).toEqual([]);
      expect(canAccessWorkspaceRoute(permissionsForTest(role), "#/equipment/1/edit")).toBe(false);
    },
  );
  it.each(["operator", "auditor", "engineer"])(
    "restricts administration routes for %s",
    (role) => {
      expect(canAccessWorkspaceRoute(permissionsForTest(role), "#/users")).toBe(false);
      expect(canAccessWorkspaceRoute(permissionsForTest(role), "#/dictionaries")).toBe(false);
      expect(
        canAccessWorkspaceRoute(permissionsForTest(role), "#/checklist-admin/templates/new"),
      ).toBe(false);
    },
  );
});
