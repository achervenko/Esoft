import type { PpeIssue } from "../../shared/api/ppe";
import { sizeLabel, formatPpeDate } from "../../modules/ppe-ui/ppe-presentation";
const normalize = (value: string) =>
  value.toLocaleLowerCase("ru").replaceAll("ё", "е");

export function searchJournalRows(issues: PpeIssue[], search: string) {
  const words = normalize(search).trim().split(/\s+/).filter(Boolean);
  return issues.filter((row) => {
    const text = normalize(
      [
        row.employeeName,
        row.position,
        row.name,
        row.article,
        row.normPpeName,
        row.normPpeArticle,
        row.issuedByName,
        row.comment,
        sizeLabel(row.sizeValue, row.clothingHeight),
        formatPpeDate(row.issuedAt),
        row.status === "ISSUED" ? "Выдано" : "Отменено",
        row.issueType === "REGULAR" ? "Нормативная" : "Дополнительная",
      ].join(" "),
    );
    return words.every((word) => text.includes(word));
  });
}
