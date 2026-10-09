import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { AdminUserAccount } from "../../shared/api/users-admin-api";
import { UserAccountFormModal } from "./UserAccountFormModal";
import { PasswordFormModal } from "./PasswordFormModal";
import { UserPhotoFormModal } from "./UserPhotoFormModal";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const user = {
  id: "1",
  username: "admin",
  email: "admin@example.com",
  photo: null,
} as AdminUserAccount;
type FormKind = "account" | "password" | "photo";
it.each([
  [new File([], "empty.jpg", { type: "image/jpeg" }), "Файл пустой."],
  [new File(["text"], "photo.txt", { type: "text/plain" }), "Для фото доступны только JPG, PNG и WebP."],
])("associates file validation error with the photo input (case %#)", (file, message) => {
  render(form("photo", false, vi.fn()));
  const input = screen.getByLabelText("Фото");
  fireEvent.change(input, { target: { files: [file] } });
  const error = screen.getByText(message);
  expect(input).toHaveAttribute("aria-invalid", "true");
  expect(input).toHaveAttribute("aria-describedby", error.id);
  fireEvent.change(input, { target: { files: [] } });
  expect(input).not.toHaveAttribute("aria-invalid");
  expect(input).not.toHaveAttribute("aria-describedby");
});
it("guards photo deletion when a replacement file is selected", () => {
  const onDelete = vi.fn();
  const onSubmit = vi.fn();
  render(
    <UserPhotoFormModal
      user={{ ...user, photo: { mediumUrl: "/photo.jpg" } } as AdminUserAccount}
      isSaving={false}
      onClose={vi.fn()}
      onDelete={onDelete}
      onSubmit={onSubmit}
    />,
  );
  change("photo");
  fireEvent.click(screen.getByRole("button", { name: "Удалить фото" }));
  expect(onDelete).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Остаться" }));
  fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
  expect(onSubmit).toHaveBeenCalledWith(expect.any(File));
  fireEvent.click(screen.getByRole("button", { name: "Удалить фото" }));
  fireEvent.click(screen.getByRole("button", { name: "Выйти" }));
  expect(onDelete).toHaveBeenCalledOnce();
});

it("deletes the existing photo without a prompt when no file is selected", () => {
  const onDelete = vi.fn();
  render(
    <UserPhotoFormModal
      user={{ ...user, photo: { mediumUrl: "/photo.jpg" } } as AdminUserAccount}
      isSaving={false}
      onClose={vi.fn()}
      onDelete={onDelete}
      onSubmit={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Удалить фото" }));
  expect(onDelete).toHaveBeenCalledOnce();
});
function form(kind: FormKind, saving: boolean, close: () => void) {
  if (kind === "account")
    return (
      <UserAccountFormModal
        user={null}
        employees={[]}
        roles={[]}
        isSaving={saving}
        onClose={close}
        onSubmit={vi.fn()}
      />
    );
  if (kind === "password")
    return (
      <PasswordFormModal
        user={user}
        isSaving={saving}
        onClose={close}
        onSubmit={vi.fn()}
      />
    );
  return (
    <UserPhotoFormModal
      user={user}
      isSaving={saving}
      onClose={close}
      onSubmit={vi.fn()}
      onDelete={vi.fn()}
    />
  );
}
function change(kind: FormKind) {
  if (kind === "account")
    fireEvent.change(screen.getByLabelText(/Логин/), {
      target: { value: "new-admin" },
    });
  else if (kind === "password")
    fireEvent.change(screen.getByLabelText(/Новый пароль/), {
      target: { value: "new-password" },
    });
  else {
    vi.stubGlobal(
      "URL",
      class extends URL {
        static createObjectURL() {
          return "blob:preview";
        }
        static revokeObjectURL() {}
      },
    );
    fireEvent.change(screen.getByLabelText("Фото"), {
      target: {
        files: [new File(["photo"], "photo.jpg", { type: "image/jpeg" })],
      },
    });
  }
}

it.each<FormKind>(["account", "password", "photo"])(
  "guards cancelling a dirty %s form",
  (kind) => {
    const close = vi.fn();
    render(form(kind, false, close));
    change(kind);
    fireEvent.click(screen.getByRole("button", { name: "Отмена" }));
    expect(close).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Остаться" }));
    fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    fireEvent.click(screen.getByRole("button", { name: "Выйти" }));
    expect(close).toHaveBeenCalledOnce();
  },
);

it.each<FormKind>(["account", "password", "photo"])(
  "blocks closing and editing a saving %s form",
  (kind) => {
    const close = vi.fn();
    render(form(kind, true, close));
    fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    fireEvent.mouseDown(document.querySelector(".admin-modal-backdrop")!);
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Отмена" })).toBeDisabled();
    for (const control of document.querySelectorAll("input"))
      expect(control).toBeDisabled();
  },
);

it("does not prompt when account changes are reverted", () => {
  const close = vi.fn();
  render(form("account", false, close));
  change("account");
  fireEvent.change(screen.getByLabelText(/Логин/), { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "Отмена" }));
  expect(close).toHaveBeenCalledOnce();
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
});
