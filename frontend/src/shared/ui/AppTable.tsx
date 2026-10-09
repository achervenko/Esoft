import "./AppTable.css";
import { Table } from "@chakra-ui/react";
import type { ReactNode } from "react";

/** Common table surface; sorting and row interactions belong to DataTable. */
export function AppTable({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Table.Root className={`data-table ${className}`.trim()} size="sm" native>
      {children}
    </Table.Root>
  );
}
