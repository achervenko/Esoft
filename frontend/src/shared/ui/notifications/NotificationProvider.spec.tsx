import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { NotificationProvider } from "./NotificationProvider";
import { useNotifications } from "./useNotifications";

describe("NotificationProvider", () => {
  it("returns the displayed notification id when duplicate notifications are merged", async () => {
    const user = userEvent.setup();
    const returnedIds: string[] = [];

    function Harness() {
      const notifications = useNotifications();

      return (
        <div>
          <button
            onClick={() => {
              returnedIds[0] = notifications.notify({
                duration: false,
                title: "Ошибка сохранения",
                type: "error",
              });
              returnedIds[1] = notifications.notify({
                duration: false,
                title: "Ошибка сохранения",
                type: "error",
              });
            }}
            type="button"
          >
            Создать дубликат
          </button>
          <button
            onClick={() => notifications.dismiss(returnedIds[1])}
            type="button"
          >
            Закрыть второй id
          </button>
        </div>
      );
    }

    render(
      <NotificationProvider>
        <Harness />
      </NotificationProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Создать дубликат" }));

    expect(returnedIds[0]).toBe(returnedIds[1]);
    expect(screen.getByRole("alert")).toHaveTextContent("Ошибка сохранения");
    expect(screen.getByText("x2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Закрыть второй id" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
