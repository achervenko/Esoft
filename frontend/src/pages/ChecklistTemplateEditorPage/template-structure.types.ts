export type TemplateStructureTarget =
  | {
      kind: "module";
      moduleId: number;
      name?: string;
      questionCount?: number;
      requiredQuestionCount?: number;
    }
  | {
      isRequired?: boolean;
      kind: "question";
      moduleId: number;
      questionId: number;
      questionIndex?: number;
      questionText?: string;
    };

export type TemplateCatalogModuleTarget = {
  checklistModuleId: number;
  kind: "catalog-module";
  name: string;
  questionCount: number;
};

export type TemplateDragTarget =
  | TemplateCatalogModuleTarget
  | TemplateStructureTarget;

export type TemplateStructureMenuState = {
  target: TemplateStructureTarget;
  x: number;
  y: number;
} | null;

export type TemplateDragPreview =
  | {
      height: number;
      kind: "module";
      name: string;
      questionCount: number;
      requiredQuestionCount: number;
      width: number;
    }
  | {
      height: number;
      isRequired: boolean;
      kind: "question";
      questionIndex: number;
      questionText: string;
      width: number;
    };
