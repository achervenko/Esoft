export type ClothingSize = { value: string; heightValue: string };
export const clothingSizes = [
  "88–92",
  "96–100",
  "104–108",
  "112–116",
  "120–124",
  "128–132",
];
export const clothingHeights = ["158–164", "170–176", "182–188", "194–200"];
export const defaultClothingSizes = (): ClothingSize[] =>
  clothingSizes.flatMap((value, index) =>
    clothingHeights
      .filter((_, height) =>
        index === 0
          ? height < 3
          : index === 4
            ? height > 0
            : index === 5
              ? height === 1 || height === 2
              : true,
      )
      .map((heightValue) => ({ value, heightValue })),
  );

export const defaultShoeSizes = () =>
  Array.from({ length: 11 }, (_, i) => String(36 + i));
