export function normalizePpeSizeText(value: string): string {
  return value
    .replace(/[\u002d\u2010-\u2015\u2212\ufe58\ufe63\uff0d]/g, '–')
    .replace(/\s*–\s*/g, '–');
}
