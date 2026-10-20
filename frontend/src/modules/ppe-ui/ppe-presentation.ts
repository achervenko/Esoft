import { getBusinessTodayDateString } from "../../shared/lib/business-date";
import { ApiRequestError } from "../../shared/api/api-error";
import type { PpeEmployee, PpeType } from "../../shared/api/ppe";
export const typeLabels: Record<PpeType, string> = {
  BODY: "Одежда",
  TSHIRT: "Футболки",
  FEET: "Обувь",
  HANDS: "Перчатки",
  HEAD: "Головной убор",
  OTHER: "Прочее / без размера",
};
export const ppeUnits = ["шт", "пары", "мл"] as const;
export function formatPpeDate(value: string | null | undefined) {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : value;
}
const quantityPlural = new Intl.PluralRules("ru-RU");
export function formatPpePeriod(count: number, unit: "DAY" | "MONTH" | "YEAR") {
  const forms: Record<string, string> =
    unit === "YEAR"
      ? { one: "год", few: "года", many: "лет", other: "года" }
      : unit === "DAY"
        ? { one: "день", few: "дня", many: "дней", other: "дня" }
        : { one: "месяц", few: "месяца", many: "месяцев", other: "месяца" };
  return `${count} ${forms[quantityPlural.select(count)]}`;
}
export function formatPpeQuantity(quantity: number, unit: string) {
  const category = quantityPlural.select(quantity);
  const label =
    unit === "пары"
      ? (
          { one: "пара", few: "пары", many: "пар", other: "пары" } as Record<
            string,
            string
          >
        )[category]
      : unit;
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 3 }).format(quantity)} ${label}`;
}
export const businessToday = getBusinessTodayDateString;
export const employeeName = (employee: PpeEmployee) =>
  [employee.lastName, employee.firstName, employee.middleName]
    .filter(Boolean)
    .join(" ");
export const sizeLabel = (value: string | null, height: string | null) =>
  [value, height].filter(Boolean).join("; ") || "Без размера";
const errorMessages: Record<string, string> = {
  PPE_ITEM_IN_NORM:
    "СИЗ уже включён в норму. Для изменения единицы или типа создайте новую позицию и новую редакцию нормы.",
  PPE_ITEM_NOT_FOUND: "Позиция СИЗ не найдена. Обновите справочник.",
  PPE_ITEM_INACTIVE: "Позиция СИЗ удалена. Выберите другую активную позицию.",
  PPE_SIZE_REQUIRED: "Выберите активный размер этой позиции СИЗ.",
  PPE_SIZE_NOT_FOUND: "Размер не найден или принадлежит другой позиции СИЗ.",
  PPE_SIZE_INACTIVE: "Выбранный размер удалён.",
  PPE_ITEM_SIZE_CONFLICT:
    "Такой размер или пара размера и ростовки уже существует.",
  PPE_ITEM_ARTICLE_CONFLICT: "СИЗ с таким артикулом уже существует.",
  PPE_ITEM_SIZES_NOT_ALLOWED: "Для СИЗ типа «Прочее» размеры не используются.",
  PPE_HEIGHT_REQUIRED: "Для одежды и футболок укажите размер и ростовку.",
  PPE_HEIGHT_NOT_ALLOWED: "Ростовка предусмотрена только для одежды и футболок.",
  PPE_SIZE_TYPE_CONFLICT: "Размерный ряд несовместим с выбранным типом СИЗ.",
  PPE_NORM_NOT_FOUND: "Норма не найдена. Обновите список норм.",
  PPE_NORM_PERIOD_CONFLICT: "Период нормы пересекается с другой редакцией.",
  PPE_NORM_LOCKED: "Норму уже нельзя изменить.",
  PPE_NORM_ALREADY_ISSUED:
    "Эта нормативная выдача уже выполнена или больше недоступна. Обновите план.",
  PPE_NORM_NOT_DUE: "Окно нормативной выдачи ещё не открыто.",
  PPE_EMPLOYEE_NOT_FOUND: "Сотрудник не найден.",
  PPE_EMPLOYEE_INACTIVE: "Сотрудник отключён. Новые выдачи недоступны.",
  PPE_ISSUE_ALREADY_CANCELLED: "Выдача уже отменена. Обновите журнал.",
  PPE_ISSUE_REFERENCE_CONFLICT:
    "Данные изменились во время операции. Обновите их и повторите попытку.",
};
export function ppeError(error: unknown) {
  if (error instanceof ApiRequestError) {
    if (error.status === 403) return "Недостаточно прав для этой операции.";
    if (error.code && errorMessages[error.code])
      return errorMessages[error.code];
    if (error.message && !error.message.startsWith("{")) return error.message;
  }
  if (error instanceof TypeError)
    return "Не удалось связаться с сервером. Проверьте соединение и повторите попытку.";
  return "Не удалось выполнить операцию. Повторите попытку.";
}
