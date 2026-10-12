export type PpeType = "BODY" | "FEET" | "HANDS" | "HEAD" | "OTHER";
export type PpeSize = {
  id: number;
  ppeItemId: number;
  value: string;
  heightValue: string | null;
  isActive: boolean;
};
export type PpeItemRecord = {
  hasActiveNorm?: boolean;
  id: number;
  article: string;
  name: string;
  unit: string;
  type: PpeType;
  isActive: boolean;
};
export type PpeItem = PpeItemRecord & { sizes: PpeSize[] };
export type PpePosition = { id: number; name: string; isActive: boolean };
export type EmployeeSizes = {
  clothingSize: string | null;
  clothingHeight: string | null;
  shoeSize: number | null;
  gloveSize: string | null;
  headwearSize: string | null;
};
export type PpeEmployee = EmployeeSizes & {
  id: number;
  firstName: string;
  lastName: string;
  middleName: string | null;
  positionId: number;
  position: string;
  isActive: boolean;
};
export type NormRow = {
  id: number;
  ppeItemId: number;
  article: string;
  name: string;
  unit: string;
  isActive: boolean;
  quantity: number;
  periodCount: number;
  periodUnit: "DAY" | "MONTH" | "YEAR";
};
export type PpeNorm = {
  transitionMode: "SOFT" | "HARD";
  id: number;
  positionId: number;
  position: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  items: NormRow[];
};
export type NormPayload = {
  transitionMode?: "SOFT" | "HARD";
  effectiveFrom: string;
  effectiveTo: string | null;
  items: Pick<
    NormRow,
    "ppeItemId" | "quantity" | "periodCount" | "periodUnit"
  >[];
};
export type PpeIssue = {
  id: number;
  employeeId: number;
  employeeName: string;
  positionId: number;
  position: string;
  issueType: "REGULAR" | "EXTRA";
  normItemId: number | null;
  normItemPpeItemId: number | null;
  normPpeArticle: string | null;
  normPpeName: string | null;
  ppeItemId: number;
  ppeItemTypeSnapshot: PpeType;
  article: string;
  name: string;
  unit: string;
  quantity: number;
  sizeValue: string | null;
  clothingHeight: string | null;
  scheduledAt: string | null;
  issuedAt: string;
  issuedByUserId: string;
  issuedByName: string;
  status: "ISSUED" | "CANCELLED";
  comment: string | null;
  cancelledAt: string | null;
  cancelledByUserId: string | null;
  cancelledByName: string | null;
  cancellationReason: string | null;
};
export type IssueResult = PpeIssue & {
  warnings: { code: string; message: string }[];
};
export type SizeRecommendation = {
  type: PpeType;
  recommendedValue: string | null;
  recommendedSizeValue: string | null;
  recommendedSizeId: number | null;
  recommendedHeightValue: string | null;
  clothingHeight: string | null;
  requiresSelection: boolean;
  activeSizes: Pick<PpeSize, "id" | "value" | "heightValue">[];
};
export type Obligation = {
  scheduledAt: string;
  quantity: number;
};
export type PlanRow = {
  normId: number;
  normEffectiveFrom: string;
  normItemId: number;
  ppeItemId: number;
  article: string;
  name: string;
  unit: string;
  type: PpeType;
  isActive: boolean;
  normQuantity: number;
  periodCount: number;
  periodUnit: "DAY" | "MONTH" | "YEAR";
  plannedDate: string | null;
  availableFrom: string | null;
  obligationStatus: "NOT_AVAILABLE" | "EARLY" | "DUE" | "OVERDUE" | "FINISHED";
  available: Obligation | null;
  nextFuture: Obligation | null;
  overdue: number;
  fulfilled: PpeIssue[];
  sizes: SizeRecommendation;
};
export type PpePlan = {
  employeeId: number;
  employeeName: string;
  positionId: number;
  position: string;
  on: string;
  norm: {
    id: number;
    effectiveFrom: string;
    effectiveTo: string | null;
  } | null;
  items: PlanRow[];
};
export type IssueRowPayload = {
  ppeItemId: number;
  sizeId?: number;
  comment?: string;
  normItemId?: number;
  quantity?: number;
};
export type IssueBatch = {
  employeeId: number;
  issuedAt?: string;
  items: IssueRowPayload[];
};
export type IssueFilters = Partial<
  Record<
    | "employeeId"
    | "positionId"
    | "ppeItemId"
    | "issueType"
    | "status"
    | "dateFrom"
    | "dateTo",
    string
  >
>;
