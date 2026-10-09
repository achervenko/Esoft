import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { UnsavedChangesGuard } from "./UnsavedChangesGuard";

afterEach(cleanup);

it.each(["link", "action"] as const)("discards a pending %s confirmation when blocking starts", (kind) => {
  const action = vi.fn();
  const initialHash = window.location.hash;
  const content = (blocked: boolean) => (
    <UnsavedChangesGuard hasChanges isBlocked={blocked}>
      {(requestLeave) => kind === "link"
        ? <a href="#/guard-test-destination">Назад</a>
        : <button onClick={() => requestLeave(action)}>Назад</button>}
    </UnsavedChangesGuard>
  );
  const view = render(content(false));
  fireEvent.click(screen.getByText("Назад"));
  expect(screen.getByRole("button", { name: "Выйти" })).toBeInTheDocument();
  view.rerender(content(true));
  expect(screen.queryByRole("button", { name: "Выйти" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByText("Назад"));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(action).not.toHaveBeenCalled();
  expect(window.location.hash).toBe(initialHash);
  view.rerender(content(false));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
