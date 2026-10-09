import { expect, it } from "vitest";
import { sortDataTableRows } from "./data-table-model";

it.each(["asc", "desc"] as const)(
  "keeps inactive employees below active employees when sorting %s",
  (direction) => {
    const rows = [
      { name: "А", active: false },
      { name: "Я", active: true },
      { name: "Б", active: true },
    ];
    const columns = [
      {
        key: "name",
        label: "Имя",
        render: (row: (typeof rows)[number]) => row.name,
        sortValue: (row: (typeof rows)[number]) => row.name,
      },
    ];
    const sorted = sortDataTableRows(
      rows,
      columns,
      { key: "name", direction },
      (row) => (row.active ? 0 : 1),
    );
    expect(sorted.map((row) => row.name)).toEqual(
      direction === "asc" ? ["Б", "Я", "А"] : ["Я", "Б", "А"],
    );
    expect(rows[0].name).toBe("А");
  },
);
