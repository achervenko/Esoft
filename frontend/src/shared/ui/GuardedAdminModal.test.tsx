import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GuardedAdminModal } from "./GuardedAdminModal";
import { UnsavedChangesGuard } from "./UnsavedChangesGuard";
afterEach(cleanup);
describe("shared unsaved-change modal adapter", () => {
  for (const action of ["button", "escape", "backdrop"] as const)
    it("guards dirty modal closing via " + action, () => {
      const close = vi.fn();
      render(
        <GuardedAdminModal title="Редактирование" hasChanges onClose={close}>
          <input aria-label="Название" defaultValue="Черновик" />
        </GuardedAdminModal>,
      );
      if (action === "button")
        fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
      if (action === "escape")
        fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
      if (action === "backdrop")
        fireEvent.mouseDown(document.querySelector(".admin-modal-backdrop")!);
      expect(close).not.toHaveBeenCalled();
      expect(
        screen.getByText("Есть несохраненные изменения"),
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Остаться" }));
      expect(screen.getByLabelText("Название")).toHaveValue("Черновик");
      fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
      fireEvent.click(screen.getByRole("button", { name: "Выйти" }));
      expect(close).toHaveBeenCalledOnce();
    });
  it("closes clean or reverted forms directly", () => {
    const close = vi.fn();
    const view = render(
      <GuardedAdminModal title="Форма" hasChanges onClose={close}>
        Данные
      </GuardedAdminModal>,
    );
    view.rerender(
      <GuardedAdminModal title="Форма" hasChanges={false} onClose={close}>
        Данные
      </GuardedAdminModal>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    expect(close).toHaveBeenCalledOnce();
    expect(
      screen.queryByText("Есть несохраненные изменения"),
    ).not.toBeInTheDocument();
  });
  it("guards custom back actions using the same confirmation", () => {
    const back = vi.fn();
    render(
      <GuardedAdminModal title="Форма" hasChanges onClose={vi.fn()}>
        {(leave) => <button onClick={() => leave(back)}>Назад</button>}
      </GuardedAdminModal>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Назад" }));
    expect(back).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Выйти" }));
    expect(back).toHaveBeenCalledOnce();
  });
  it("keeps beforeunload protection compatible with existing usage", () => {
    const view = render(<UnsavedChangesGuard hasChanges />);
    let event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    view.rerender(<UnsavedChangesGuard hasChanges={false} />);
    event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
  it("retains link confirmation for existing consumers", () => {
    render(
      <>
        <a href="#/another">Перейти</a>
        <UnsavedChangesGuard hasChanges />
      </>,
    );
    fireEvent.click(screen.getByRole("link"));
    expect(
      screen.getByText("Есть несохраненные изменения"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Остаться" }));
    expect(screen.getByRole("link")).toBeInTheDocument();
  });
  it("blocks closing and link navigation while saving", () => {
    const close = vi.fn();
    render(
      <GuardedAdminModal
        title="Форма"
        hasChanges
        isCloseDisabled
        onClose={close}
      >
        <a href="#/another">Перейти</a>
      </GuardedAdminModal>,
    );
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    fireEvent.click(screen.getByRole("link"));
    expect(close).not.toHaveBeenCalled();
    expect(
      screen.queryByText("Есть несохраненные изменения"),
    ).not.toBeInTheDocument();
  });
});
