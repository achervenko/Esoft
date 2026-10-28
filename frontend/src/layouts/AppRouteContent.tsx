import type { AppRoute } from "./app-router";
import type { AppShellUser } from "./AppShell";
import {
  CalendarPage,
  DashboardPage,
  ChecklistAdminPage,
  ChecklistTemplateEditorPage,
  ChecklistTemplateViewPage,
  DictionariesPage,
  WarehouseStockPage,
  WarehouseCatalogPage,
  PpePage,
  EquipmentCreatePage,
  EquipmentEditPage,
  EquipmentPage,
  EquipmentViewPage,
  MyChecklistsPage,
  MyChecklistViewPage,
  ProfilePage,
  ProductionCalendarPage,
  SearchPage,
  UsersPage,
} from "./app-pages";

type AppRouteContentProps = {
  appRoute: AppRoute;
  user: AppShellUser | null;
  onUserRefresh?: () => void;
};

export function AppRouteContent({
  appRoute,
  user,
  onUserRefresh,
}: AppRouteContentProps) {
  return (
    <>
      {appRoute.kind === "dashboard" ? <DashboardPage /> : null}
      {appRoute.kind === "calendar" ? (
        <CalendarPage
          initialDate={appRoute.date}
          userPermissions={user?.permissions ?? null}
        />
      ) : null}
      {appRoute.kind === "checklist-admin" ? (
        <ChecklistAdminPage userPermissions={user?.permissions ?? null} />
      ) : null}
      {appRoute.kind === "checklist-template-create" ? (
        <ChecklistTemplateEditorPage
          copyFromTemplateId={appRoute.copyFromTemplateId}
          templateId={null}
          userPermissions={user?.permissions ?? null}
        />
      ) : null}
      {appRoute.kind === "checklist-template-view" ? (
        <ChecklistTemplateViewPage
          templateId={appRoute.templateId}
          userPermissions={user?.permissions ?? null}
        />
      ) : null}
      {appRoute.kind === "dictionaries" ? (
        <DictionariesPage userPermissions={user?.permissions ?? null} />
      ) : null}
      {appRoute.kind === "warehouse-stock" ? (
        <WarehouseStockPage userPermissions={user?.permissions ?? null} />
      ) : null}
      {appRoute.kind === "warehouse-catalog" ? (
        <WarehouseCatalogPage userPermissions={user?.permissions ?? null} />
      ) : null}
      {appRoute.kind === "ppe" ? (
        <PpePage
          employeeId={appRoute.employeeId}
          positionId={appRoute.positionId}
          userPermissions={user?.permissions ?? null}
          initialTab={appRoute.tab}
        />
      ) : null}
      {appRoute.kind === "equipment-list" ? (
        <EquipmentPage userPermissions={user?.permissions ?? null} />
      ) : null}
      {appRoute.kind === "my-checklists-list" ? (
        <MyChecklistsPage route={appRoute.route} />
      ) : null}
      {appRoute.kind === "my-checklists-view" ? (
        <MyChecklistViewPage
          fallbackTab={appRoute.fallbackTab}
          checklistId={appRoute.checklistId}
          currentUserId={user?.id ?? null}
        />
      ) : null}
      {appRoute.kind === "search" ? (
        <SearchPage userPermissions={user?.permissions ?? null} />
      ) : null}
      {appRoute.kind === "profile" ? <ProfilePage user={user} /> : null}
      {appRoute.kind === "production-calendar" ? (
        <ProductionCalendarPage userPermissions={user?.permissions ?? null} />
      ) : null}
      {appRoute.kind === "equipment-create" ? (
        <EquipmentCreatePage userPermissions={user?.permissions ?? null} />
      ) : null}
      {appRoute.kind === "equipment-edit" ? (
        <EquipmentEditPage
          initialTab={appRoute.initialTab}
          returnTo={appRoute.returnTo}
          userPermissions={user?.permissions ?? null}
          visibleId={appRoute.visibleId}
        />
      ) : null}
      {appRoute.kind === "equipment-view" ? (
        <EquipmentViewPage
          eventId={appRoute.eventId}
          initialTab={appRoute.initialTab}
          returnTo={appRoute.returnTo}
          userPermissions={user?.permissions ?? null}
          visibleId={appRoute.visibleId}
        />
      ) : null}
      {appRoute.kind === "users" ? (
        <UsersPage
          currentUserId={user?.id ?? null}
          onCurrentUserChanged={onUserRefresh}
          userPermissions={user?.permissions ?? null}
        />
      ) : null}
    </>
  );
}
