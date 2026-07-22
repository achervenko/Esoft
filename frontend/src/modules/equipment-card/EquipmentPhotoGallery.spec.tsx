import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createEquipmentPhoto } from "./equipment-card.test-helpers";
import { EquipmentPhotoGallery } from "./EquipmentPhotoGallery";

vi.mock("../../shared/ui/AsyncImage", () => ({
  AsyncImage: ({ alt, src }: { alt?: string; src: string }) => (
    <img alt={alt ?? ""} src={src} />
  ),
}));

describe("EquipmentPhotoGallery", () => {
  it("renders placeholder states for loading, error and empty photos", () => {
    const { rerender } = render(
      <EquipmentPhotoGallery isLoading photos={[]} />,
    );

    expect(screen.getByText("Загрузка фото...")).toBeInTheDocument();

    rerender(
      <EquipmentPhotoGallery error="Не удалось загрузить фото" photos={[]} />,
    );
    expect(screen.getByText("Не удалось загрузить фото")).toBeInTheDocument();

    rerender(<EquipmentPhotoGallery photos={[]} />);
    expect(screen.getByText("Фото не загружено")).toBeInTheDocument();
  });

  it("sorts photos by primary flag and opens preview modal", async () => {
    const user = userEvent.setup();

    render(
      <EquipmentPhotoGallery
        photos={[
          createEquipmentPhoto({ displayName: "Второе.jpg", id: 20 }),
          createEquipmentPhoto({
            displayName: "Главное.jpg",
            id: 10,
            isPrimary: true,
          }),
        ]}
      />,
    );

    const previewButton = screen.getByRole("button", {
      name: "Открыть фото оборудования",
    });
    const previewImage = screen.getByRole("img", { name: "Главное.jpg" });

    expect(previewImage).toHaveAttribute("src", "/api/files/10/preview?size=medium");

    await user.click(previewButton);

    expect(
      screen.getByRole("dialog", { name: "Увеличенное фото оборудования" }),
    ).toBeInTheDocument();
  });

  it("supports photo navigation", async () => {
    const user = userEvent.setup();

    render(
      <EquipmentPhotoGallery
        photos={[
          createEquipmentPhoto({ displayName: "Фото 1.jpg", id: 10 }),
          createEquipmentPhoto({ displayName: "Фото 2.jpg", id: 20 }),
        ]}
      />,
    );

    expect(screen.getByRole("img", { name: "Фото 2.jpg" })).toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Следующее фото" }),
    );

    expect(screen.getByText("2 / 2")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Фото 1.jpg" })).toBeInTheDocument();
  });
});
