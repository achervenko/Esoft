import { describe, expect, it } from "vitest";
import {
  getProfileModuleAccess,
  getProfilePermissionAccess,
} from "./profile-access";

const ppePermissionTitles = [
  "Чтение СИЗ",
  "Управление каталогом СИЗ",
  "Изменение размеров сотрудников",
];

describe("PPE access in profile", () => {
  it.each([
    ["admin", true, true, true],
    ["ppe_specialist", true, false, false],
    ["accounting_specialist", false, true, false],
    ["chief_engineer", false, false, false],
    ["engineer", false, false, false],
    ["operator", false, false, false],
    ["auditor", false, false, false],
    ["unknown", false, false, false],
    [null, false, false, false],
    [undefined, false, false, false],
  ] as const)(
    "reflects norms, issue and backdate permissions for %s",
    (role, norms, issue, backdate) => {
      const permissions = getProfilePermissionAccess(role);
      for (const [title, allowed] of [
        ["Управление нормами СИЗ", norms],
        ["Выдача СИЗ", issue],
      ] as const) {
        expect(
          permissions.find((permission) => permission.title === title),
        ).toMatchObject({ allowed });
      }
      const backdatePermission = permissions.find(
        (permission) => permission.title === "Выдача СИЗ задним числом",
      );
      if (role === "admin") {
        expect(backdatePermission).toMatchObject({ allowed: backdate });
      } else {
        expect(backdatePermission).toBeUndefined();
      }
    },
  );
  it.each([
    ["admin", true],
    ["ppe_specialist", true],
    ["chief_engineer", false],
    ["engineer", false],
    ["operator", false],
    ["auditor", false],
    ["unknown", false],
    [null, false],
    [undefined, false],
  ] as const)("reflects PPE access for %s", (role, allowed) => {
    expect(
      getProfileModuleAccess(role).some(({ title }) => title === "СИЗ"),
    ).toBe(allowed);
    const permissions = getProfilePermissionAccess(role);
    for (const title of ppePermissionTitles) {
      expect(
        permissions.find((permission) => permission.title === title),
      ).toMatchObject({ allowed });
    }
  });

  it.each(["ppe_specialist", "accounting_specialist"])(
    "does not grant administrative or equipment permissions to %s",
    (role) => {
      const permissions = getProfilePermissionAccess(role);
      for (const title of [
        "Редактирование оборудования",
        "Управление документами",
        "Управление пользователями",
        "Управление справочниками",
        "Просмотр оборудования",
        "Скачивание документов",
      ]) {
        expect(
          permissions.find((permission) => permission.title === title),
        ).toMatchObject({ allowed: false });
      }
    },
  );
  it("reflects the accounting specialist's distinct PPE permissions", () => {
    expect(
      getProfileModuleAccess("accounting_specialist")
        .map((module) => module.title)
        .sort(),
    ).toEqual(["Поиск", "Профиль", "СИЗ"].sort());

    const permissions = getProfilePermissionAccess("accounting_specialist");
    for (const [title, allowed] of [
      ["Чтение СИЗ", true],
      ["Управление каталогом СИЗ", true],
      ["Изменение размеров сотрудников", false],
    ] as const) {
      expect(
        permissions.find((permission) => permission.title === title),
      ).toMatchObject({ allowed });
    }
  });
  it("lists search, PPE, employee sizes and profile modules for the specialist", () => {
    expect(
      getProfileModuleAccess("ppe_specialist")
        .map((module) => module.title)
        .sort(),
    ).toEqual(["Поиск", "Профиль", "СИЗ", "Сотрудники"].sort());
  });
});
