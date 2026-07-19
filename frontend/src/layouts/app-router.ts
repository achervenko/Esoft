import { parseEquipmentViewTab } from "../modules/equipment-card";
import { getActiveTab } from "../pages/my-checklists/my-checklists.utils";
import {
  getHashRouteParam,
  getSafeReturnTo,
} from "../shared/lib/hash-navigation";

type EquipmentEditTab = "details" | "documents";

type AppRouteBase =
  | { kind: "dashboard" }
  | { kind: "checklist-admin" }
  | { kind: "checklist-template-create"; copyFromTemplateId: number | null }
  | { kind: "checklist-template-view"; templateId: number }
  | { kind: "dictionaries" }
  | { kind: "equipment-list" }
  | { kind: "equipment-create" }
  | {
      kind: "equipment-edit";
      initialTab: EquipmentEditTab;
      returnTo: string;
      visibleId: number;
    }
  | {
      kind: "equipment-view";
      initialTab: ReturnType<typeof parseEquipmentViewTab>;
      returnTo: string;
      visibleId: number;
    }
  | { kind: "my-checklists-list"; route: string }
  | {
      kind: "my-checklists-view";
      checklistId: number;
      fallbackTab: ReturnType<typeof getActiveTab>;
    }
  | { kind: "profile" }
  | { kind: "search" }
  | { kind: "users" };

export type AppRoute = AppRouteBase | { kind: "unknown" };

function parsePositiveRouteId(match: RegExpMatchArray | null) {
  if (!match) {
    return null;
  }

  const value = Number(match[1]);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function parsePositiveParamId(value: string | null) {
  if (!value) {
    return null;
  }

  const parsedValue = Number(value);
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

export function resolveAppRoute(route: string): AppRoute {
  if (route === "#/dashboard") {
    return { kind: "dashboard" };
  }

  if (route === "#/checklist-admin" || route.startsWith("#/checklist-admin?")) {
    return { kind: "checklist-admin" };
  }

  if (/^#\/checklist-admin\/templates\/new(?:\?.*)?$/.test(route)) {
    return {
      kind: "checklist-template-create",
      copyFromTemplateId: parsePositiveParamId(
        getHashRouteParam(route, "copyFrom"),
      ),
    };
  }

  const checklistTemplateViewId = parsePositiveRouteId(
    route.match(/^#\/checklist-admin\/templates\/(\d+)(?:\?.*)?$/),
  );

  if (checklistTemplateViewId !== null) {
    return {
      kind: "checklist-template-view",
      templateId: checklistTemplateViewId,
    };
  }

  if (route === "#/dictionaries") {
    return { kind: "dictionaries" };
  }

  if (route === "#/equipment") {
    return { kind: "equipment-list" };
  }

  if (route === "#/equipment/create") {
    return { kind: "equipment-create" };
  }

  const equipmentEditId = parsePositiveRouteId(
    route.match(/^#\/equipment\/(\d+)\/edit(?:\?.*)?$/),
  );

  if (equipmentEditId !== null) {
    const tab = getHashRouteParam(route, "tab");

    return {
      kind: "equipment-edit",
      initialTab: tab === "documents" ? "documents" : "details",
      returnTo: getSafeReturnTo(getHashRouteParam(route, "returnTo")),
      visibleId: equipmentEditId,
    };
  }

  const equipmentViewId = parsePositiveRouteId(
    route.match(/^#\/equipment\/(\d+)(?:\?.*)?$/),
  );

  if (equipmentViewId !== null) {
    return {
      kind: "equipment-view",
      initialTab: parseEquipmentViewTab(getHashRouteParam(route, "tab")),
      returnTo: getSafeReturnTo(getHashRouteParam(route, "returnTo")),
      visibleId: equipmentViewId,
    };
  }

  if (route === "#/my-checklists" || route.startsWith("#/my-checklists?")) {
    return { kind: "my-checklists-list", route };
  }

  const myChecklistViewId = parsePositiveRouteId(
    route.match(/^#\/my-checklists\/(\d+)(?:\?.*)?$/),
  );

  if (myChecklistViewId !== null) {
    return {
      kind: "my-checklists-view",
      checklistId: myChecklistViewId,
      fallbackTab: getActiveTab(route),
    };
  }

  if (route === "#/profile") {
    return { kind: "profile" };
  }

  if (route === "#/search" || route.startsWith("#/search?")) {
    return { kind: "search" };
  }

  if (route === "#/users") {
    return { kind: "users" };
  }

  return { kind: "unknown" };
}
