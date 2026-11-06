import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { UsersPage } from "./UsersPage";
vi.mock("./useUsersAdminPage", () => ({
  useUsersAdminPage: ({
    userPermissions,
  }: {
    userPermissions: readonly string[] | null;
  }) => ({
    usersManageable: userPermissions?.includes("users.manage") ?? false,
    users: [],
    isLoading: false,
    userForm: null,
    passwordUser: null,
    photoUser: null,
  }),
}));
vi.mock("./UserAccountsTable", () => ({
  UserAccountsTable: () => <div>Список учётных записей</div>,
}));
vi.mock("../../modules/integrations/ReceiptIntegrationPanel", () => ({
  ReceiptIntegrationPanel: () => <div>Настройки обмена</div>,
}));
afterEach(cleanup);
it("hides the integration tab without integration permission", () => {
  render(<UsersPage userPermissions={["users.manage"]} />);
  expect(
    screen.queryByRole("tab", { name: "Интеграции" }),
  ).not.toBeInTheDocument();
  expect(screen.getByText("Список учётных записей")).toBeInTheDocument();
});
it("opens integration only for an administrator with integration access", () => {
  render(
    <UsersPage userPermissions={["users.manage", "integrations.manage"]} />,
  );
  fireEvent.click(screen.getByRole("tab", { name: "Интеграции" }));
  expect(screen.getByText("Настройки обмена")).toBeInTheDocument();
  expect(screen.queryByText("Список учётных записей")).not.toBeInTheDocument();
});

it("opens integration without user account management permission", () => {
  render(<UsersPage userPermissions={["integrations.manage"]} />);
  expect(screen.getByRole("tab", { name: "Интеграции" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(
    screen.queryByRole("tab", { name: "Учётные записи" }),
  ).not.toBeInTheDocument();
  expect(screen.getByText("Настройки обмена")).toBeInTheDocument();
  expect(screen.queryByText("Список учётных записей")).not.toBeInTheDocument();
});
it("denies access when neither permission is granted", () => {
  render(<UsersPage userPermissions={[]} />);
  expect(screen.getByRole("alert")).toHaveTextContent("Недостаточно прав");
  expect(screen.queryByText("Настройки обмена")).not.toBeInTheDocument();
  expect(screen.queryByText("Список учётных записей")).not.toBeInTheDocument();
});
it("falls back to the allowed tab when permissions change", () => {
  const { rerender } = render(
    <UsersPage userPermissions={["users.manage", "integrations.manage"]} />,
  );
  fireEvent.click(screen.getByRole("tab", { name: "Интеграции" }));
  rerender(<UsersPage userPermissions={["users.manage"]} />);
  expect(screen.getByText("Список учётных записей")).toBeInTheDocument();
  expect(screen.queryByText("Настройки обмена")).not.toBeInTheDocument();
  rerender(<UsersPage userPermissions={["integrations.manage"]} />);
  expect(screen.getByText("Настройки обмена")).toBeInTheDocument();
  expect(screen.queryByText("Список учётных записей")).not.toBeInTheDocument();
});
