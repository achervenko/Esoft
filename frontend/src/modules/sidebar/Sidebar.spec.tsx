import { permissionsForTest } from "../../test/permission-fixtures";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "./Sidebar";

const adminUser = {
  role: "admin", permissions: permissionsForTest("admin"),
  username: "admin",
};

function setHashRoute(route: string) {
  window.location.hash = route;
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

describe("Sidebar", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        addEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
        matches: false,
        media: query,
        onchange: null,
        removeEventListener: vi.fn(),
      })),
    });

    window.location.hash = "#/dashboard";
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it.each([
    ["admin", "#/dashboard"],
    ["ppe_specialist", "#/ppe"],
    ["accounting_specialist", "#/ppe"],
    ["storekeeper", "#/profile"],
  ])("links the brand to an accessible default for %s", (role, expected) => {
    render(<Sidebar onLogout={vi.fn()} user={{ role, permissions: permissionsForTest(role) }} />);
    expect(screen.getByRole("link", { name: "Esoft" })).toHaveAttribute("href", expected);
  });
  it("keeps the existing top-level links unchanged", () => {
    render(<Sidebar onLogout={vi.fn()} user={adminUser} />);

    expect(screen.getByRole("heading", { name: "Основное" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Панель" })).toHaveAttribute(
      "href",
      "#/dashboard",
    );
    expect(screen.getByRole("link", { name: "Оборудование" })).toHaveAttribute(
      "href",
      "#/equipment",
    );
    expect(screen.getByRole("link", { name: "Календарь" })).toHaveAttribute(
      "href",
      "#/calendar",
    );
    expect(screen.getByRole("link", { name: "Поиск" })).toHaveAttribute(
      "href",
      "#/search",
    );
  });

  it("shows PPE and limited employee navigation to specialists without other admin links", () => {
    render(<Sidebar onLogout={vi.fn()} user={{ role: "ppe_specialist", permissions: permissionsForTest("ppe_specialist") }} />);
    expect(screen.getByRole("link", { name: "СИЗ" })).toHaveAttribute(
      "href",
      "#/ppe",
    );
    expect(screen.getByRole("link", { name: "Сотрудники" })).toHaveAttribute(
      "href",
      "#/dictionaries",
    );
    expect(screen.queryByRole("link", { name: "Пользователи" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Справочники" })).toBeNull();
    for (const name of [
      "Панель",
      "Оборудование",
      "Календарь",
      "Мои чек-листы",
    ]) {
      expect(screen.queryByRole("link", { name })).toBeNull();
    }
  });

  it("renders checklist and administration sections as collapsible menu buttons", () => {
    render(<Sidebar onLogout={vi.fn()} user={adminUser} />);

    expect(screen.queryByRole("heading", { name: "Чек-листы" })).toBeNull();
    expect(
      screen.queryByRole("heading", { name: "Администрирование" }),
    ).toBeNull();
    expect(screen.getByRole("button", { name: "Чек-листы" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(
      screen.getByRole("button", { name: "Администрирование" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("renders a group with one visible child as a regular sidebar link", () => {
    render(
      <Sidebar
        onLogout={vi.fn()}
        user={{ role: "engineer", permissions: permissionsForTest("engineer"), username: "engineer" }}
      />,
    );

    expect(screen.queryByRole("button", { name: "Чек-листы" })).toBeNull();
    expect(screen.getByRole("link", { name: "Мои чек-листы" })).toHaveAttribute(
      "href",
      "#/my-checklists",
    );
    expect(
      screen.queryByRole("link", { name: "Редактор чек-листов" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Администрирование" }),
    ).toBeNull();
  });

  it("opens the active group, allows manual collapse, and opens a newly active group", async () => {
    const user = userEvent.setup();

    setHashRoute("#/my-checklists");
    render(<Sidebar onLogout={vi.fn()} user={adminUser} />);

    const checklistGroup = screen.getByRole("button", { name: "Чек-листы" });
    const administrationGroup = screen.getByRole("button", {
      name: "Администрирование",
    });

    expect(checklistGroup).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Мои чек-листы" })).toHaveClass(
      "active",
    );

    await user.click(checklistGroup);

    expect(checklistGroup).toHaveAttribute("aria-expanded", "false");

    act(() => {
      setHashRoute("#/users");
    });

    await waitFor(() =>
      expect(administrationGroup).toHaveAttribute("aria-expanded", "true"),
    );
    expect(screen.getByRole("link", { name: "Пользователи" })).toHaveClass(
      "active",
    );
  });

  it("uses mobile open state for the toggle button accessible name", async () => {
    const user = userEvent.setup();

    vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: true,
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    }));

    render(<Sidebar onLogout={vi.fn()} user={adminUser} />);

    const openButton = screen.getByRole("button", {
      name: "Развернуть меню",
    });
    expect(openButton).toHaveAttribute("title", "Развернуть меню");

    await user.click(openButton);

    const closeButton = screen.getByRole("button", {
      name: "Свернуть меню",
    });
    expect(closeButton).toHaveAttribute("title", "Свернуть меню");
  });
});
