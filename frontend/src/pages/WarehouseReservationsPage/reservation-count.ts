export function countNoun(
  count: number,
  forms: readonly [string, string, string],
) {
  const tail = count % 100;
  const digit = count % 10;
  return forms[
    tail >= 11 && tail <= 14
      ? 2
      : digit === 1
        ? 0
        : digit >= 2 && digit <= 4
          ? 1
          : 2
  ];
}
