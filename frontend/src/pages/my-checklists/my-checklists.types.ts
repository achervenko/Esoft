import type {
  ChecklistAnswerType,
  ChecklistWorkDetail,
  ChecklistWorkListItem,
  ChecklistWorkListResponse,
  ChecklistWorkModule,
  ChecklistWorkProgress,
  ChecklistWorkQuestion,
  ChecklistWorkStatus,
} from "../../shared/api/checklists";
import type { ChecklistTabKey } from "./my-checklists.config";

export type DraftAnswers = Record<number, string>;

export type MyChecklistActionErrorResult = {
  detailError: string | null;
  formError: string | null;
  versionConflict: string | null;
};

export type MyChecklistsTabsProps = {
  activeTab: ChecklistTabKey;
  tabCounts: Partial<Record<ChecklistTabKey, number>>;
};

export type MyChecklistsListProps = {
  getChecklistHref: (
    checklistId: number,
    checklistStatus: ChecklistWorkStatus,
  ) => string;
  isLoading: boolean;
  items: ChecklistWorkListItem[];
};

export type MyChecklistCardProps = {
  href: string;
  item: ChecklistWorkListItem;
};

export type MyChecklistDetailProps = {
  canMutateSelected: boolean;
  checklist: ChecklistWorkDetail | null;
  draftAnswers: DraftAnswers;
  emptyMessage?: string;
  formError: string | null;
  isActionLoading: boolean;
  isDetailLoading: boolean;
  onAnswerChange: (checklistDetailId: number, value: string) => void;
  onComplete: () => void;
  onReload: () => void;
  onSave: () => void;
  onStart: () => void;
  showRequiredErrors: boolean;
  versionConflict: string | null;
};

export type ChecklistSummaryProps = {
  checklist: ChecklistWorkDetail;
};

export type ChecklistModulesProps = {
  canEdit: boolean;
  draftAnswers: DraftAnswers;
  modules: ChecklistWorkModule[];
  onAnswerChange: (checklistDetailId: number, value: string) => void;
  showRequiredErrors: boolean;
};

export type ChecklistQuestionProps = {
  canEdit: boolean;
  onAnswerChange: (checklistDetailId: number, value: string) => void;
  question: ChecklistWorkQuestion;
  showRequiredError: boolean;
  value: string;
};

export type ChecklistAnswerFieldProps = {
  answerType: ChecklistAnswerType;
  disabled: boolean;
  hasError?: boolean;
  onChange: (value: string) => void;
  value: string;
};

export type UseMyChecklistsListParams = {
  activeTab: ChecklistTabKey;
};

export type UseChecklistWorkParams = {
  checklistId: number;
  currentUserId: string | null;
};

export type MyChecklistsListState = {
  error: string | null;
  isLoading: boolean;
  items: ChecklistWorkListItem[];
  total: number;
  totalsByStatus: ChecklistWorkListResponse["totalsByStatus"];
};

export type ChecklistProgressLike = Pick<
  ChecklistWorkProgress,
  "answered" | "total"
>;

export type ChecklistTabCountMap = Partial<Record<ChecklistTabKey, number>>;

export type ChecklistStatusCountMap = Partial<Record<ChecklistWorkStatus, number>>;
