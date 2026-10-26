import "./AppTable.css";
import { Table } from "@chakra-ui/react";
import {
  Children,
  Fragment,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { useProgressiveRows } from "../lib/useProgressiveRows";
import { LoadMore } from "./LoadMore";

function flatten(nodes: ReactNode): ReactNode[] {
  return Children.toArray(nodes).flatMap((node) =>
    isValidElement<{ children?: ReactNode }>(node) && node.type === Fragment
      ? flatten(node.props.children)
      : [node],
  );
}

/** Common table surface; sorting and row interactions belong to DataTable. */
export function AppTable({
  children,
  className = "",
  incremental = true,
}: {
  children: ReactNode;
  className?: string;
  incremental?: boolean;
}) {
  const sections = flatten(children);
  const bodies = sections.filter(
    (node): node is ReactElement<{ children?: ReactNode }> =>
      isValidElement(node) && node.type === "tbody",
  );
  const rows = bodies.flatMap((body) => flatten(body.props.children));
  const visible = useProgressiveRows(rows, (row, index) =>
    isValidElement(row) ? (row.key ?? index) : index,
  );
  let remaining = incremental ? visible.rows.length : rows.length;
  return (
    <>
      <Table.Root className={`data-table ${className}`.trim()} size="sm" native>
        {sections.map((section) => {
          if (
            !isValidElement<{ children?: ReactNode }>(section) ||
            section.type !== "tbody"
          )
            return section;
          const body = flatten(section.props.children);
          const shown = body.slice(0, remaining);
          remaining = Math.max(0, remaining - body.length);
          return cloneElement(section, {}, shown);
        })}
      </Table.Root>
      {incremental && rows.length > 100 && (
        <LoadMore
          shown={visible.rows.length}
          total={rows.length}
          hasMore={visible.hasMore}
          loading={false}
          error={null}
          onLoadMore={visible.loadMore}
          onRetry={visible.loadMore}
        />
      )}
    </>
  );
}
