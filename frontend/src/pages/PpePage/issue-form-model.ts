import type { PlanRow, IssueRowPayload } from "../../shared/api/ppe";
export type Draft = {
  key: number;
  ppeItemId: number;
  sizeId: string;
  comment: string;
  quantity: string;
  ready: boolean;
  requiresSelection: boolean;
  norm: PlanRow | null;
};

export const comparable = (rows: Draft[]) =>
  JSON.stringify(
    rows.map(({ key, ppeItemId, sizeId, comment, quantity }) => ({
      key,
      ppeItemId,
      sizeId,
      comment,
      quantity,
    })),
  );

export function buildIssuePayload(drafts: Draft[]): IssueRowPayload[] {
  return drafts.map((row) => ({
    ppeItemId: row.ppeItemId,
    ...(row.norm
      ? { normItemId: row.norm.normItemId }
      : { quantity: Number(row.quantity) }),
    ...(row.sizeId ? { sizeId: Number(row.sizeId) } : {}),
    ...(row.comment.trim() ? { comment: row.comment.trim() } : {}),
  }));
}
