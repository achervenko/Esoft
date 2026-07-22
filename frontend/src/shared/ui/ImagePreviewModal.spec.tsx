import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ImagePreviewModal } from "./ImagePreviewModal";

describe("ImagePreviewModal", () => {
  it("renders in document.body through a portal", () => {
    const { container } = render(
      <ImagePreviewModal
        ariaLabel="Просмотр изображения"
        imageAlt="Фото"
        imageUrl="/test.jpg"
        onClose={vi.fn()}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Просмотр изображения" });

    expect(document.body).toContainElement(dialog);
    expect(container).not.toContainElement(dialog);
  });

  it("closes on Escape and restores focus to the opener", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const getClientRectsSpy = vi
      .spyOn(HTMLElement.prototype, "getClientRects")
      .mockImplementation(
        () =>
          ({
            item: () => null,
            length: 1,
            [Symbol.iterator]: function* iterator() {},
          }) as DOMRectList,
      );

    function ModalHarness() {
      const [isOpen, setIsOpen] = useState(false);

      return (
        <div>
          <button onClick={() => setIsOpen(true)} type="button">
            Открыть
          </button>
          {isOpen ? (
            <ImagePreviewModal
              ariaLabel="Просмотр изображения"
              imageAlt="Фото"
              imageUrl="/test.jpg"
              onClose={() => {
                onClose();
                setIsOpen(false);
              }}
            />
          ) : null}
        </div>
      );
    }

    render(<ModalHarness />);

    const opener = screen.getByRole("button", { name: "Открыть" });
    const openerFocusSpy = vi.spyOn(opener, "focus");
    await user.click(opener);

    const closeButton = screen.getByRole("button", { name: "Закрыть" });
    closeButton.focus();
    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(openerFocusSpy).toHaveBeenCalled();

    getClientRectsSpy.mockRestore();
  });

  it("keeps focus inside the dialog with Tab navigation", async () => {
    const user = userEvent.setup();
    const getClientRectsSpy = vi
      .spyOn(HTMLElement.prototype, "getClientRects")
      .mockImplementation(
        () =>
          ({
            item: () => null,
            length: 1,
            [Symbol.iterator]: function* iterator() {},
          }) as DOMRectList,
      );

    render(
      <ImagePreviewModal
        ariaLabel="Просмотр изображения"
        counterLabel="1 / 2"
        imageAlt="Фото"
        imageUrl="/test.jpg"
        onClose={vi.fn()}
        onNext={vi.fn()}
        onPrevious={vi.fn()}
      />,
    );

    const closeButton = screen.getByRole("button", { name: "Закрыть" });
    const nextButton = screen.getByRole("button", { name: "Следующее фото" });

    expect(closeButton).toHaveFocus();

    await user.tab({ shift: true });
    expect(nextButton).toHaveFocus();

    await user.tab();
    expect(closeButton).toHaveFocus();

    getClientRectsSpy.mockRestore();
  });
});
