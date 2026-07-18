import type {
  ChecklistAnswerType,
  ChecklistWorkDetail,
  ChecklistWorkListItem,
  ChecklistWorkModule,
  ChecklistWorkProgress,
  ChecklistWorkQuestion,
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
};

export type MyChecklistsListProps = {
  currentUserId: string | null;
  isLoading: boolean;
  items: ChecklistWorkListItem[];
  onOpen: (checklistId: number) => void;
  onStart: (item: ChecklistWorkListItem) => void;
};

export type MyChecklistCardProps = {
  currentUserId: string | null;
  item: ChecklistWorkListItem;
  onOpen: (checklistId: number) => void;
  onStart: (item: ChecklistWorkListItem) => void;
};

export type MyChecklistDetailProps = {
  canMutateSelected: boolean;
  checklist: ChecklistWorkDetail | null;
  draftAnswers: DraftAnswers;
  formError: string | null;
  isActionLoading: boolean;
  isDetailLoading: boolean;
  onAnswerChange: (checklistDetailId: number, value: string) => void;
  onComplete: () => void;
  onReload: () => void;
  onSave: () => void;
  onStart: () => void;
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
};

export type ChecklistQuestionProps = {
  canEdit: boolean;
  onChange: (value: string) => void;
  question: ChecklistWorkQuestion;
  value: string;
};

export type ChecklistAnswerFieldProps = {
  answerType: ChecklistAnswerType;
  disabled: boolean;
  onChange: (value: string) => void;
  value: string;
};

export type UseMyChecklistsListParams = {
  activeTab: ChecklistTabKey;
  onSelectedChecklistMissing: () => void;
  selectedChecklistId: number | null;
};

export type UseChecklistWorkParams = {
  currentUserId: string | null;
  onChecklistStarted?: (checklist: ChecklistWorkDetail) => void;
  onSelectChecklistId: (checklistId: number | null) => void;
  reloadItems: () => Promise<ChecklistWorkListItem[] | null>;
  selectedChecklistId: number | null;
};

export type ChecklistProgressLike = Pick<
  ChecklistWorkProgress,
  "answered" | "total"
>;
