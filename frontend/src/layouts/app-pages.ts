import { lazy, type ComponentType } from "react";

function lazyNamedPage<TProps>(loadPage: () => Promise<ComponentType<TProps>>) {
  return lazy(async () => ({
    default: await loadPage(),
  }));
}

export const CalendarPage = lazyNamedPage(() =>
  import("../pages/CalendarPage").then((module) => module.CalendarPage),
);

export const DashboardPage = lazyNamedPage(() =>
  import("../pages/DashboardPage").then((module) => module.DashboardPage),
);

export const ChecklistAdminPage = lazyNamedPage(() =>
  import("../pages/ChecklistAdminPage").then(
    (module) => module.ChecklistAdminPage,
  ),
);

export const ChecklistTemplateEditorPage = lazyNamedPage(() =>
  import("../pages/ChecklistTemplateEditorPage").then(
    (module) => module.ChecklistTemplateEditorPage,
  ),
);

export const ChecklistTemplateViewPage = lazyNamedPage(() =>
  import("../pages/ChecklistTemplateViewPage").then(
    (module) => module.ChecklistTemplateViewPage,
  ),
);

export const DictionariesPage = lazyNamedPage(() =>
  import("../pages/DictionariesPage").then((module) => module.DictionariesPage),
);
export const WarehouseStockPage = lazyNamedPage(() =>
  import("../pages/WarehouseStockPage/WarehouseStockPage").then(
    (module) => module.WarehouseStockPage,
  ),
);
export const WarehouseCatalogPage = lazyNamedPage(() =>
  import("../pages/WarehouseCatalogPage/WarehouseCatalogPage").then(
    (module) => module.WarehouseCatalogPage,
  ),
);

export const PpePage = lazyNamedPage(() =>
  import("../pages/PpePage").then((module) => module.PpePage),
);

export const EquipmentCreatePage = lazyNamedPage(() =>
  import("../pages/EquipmentCreatePage").then(
    (module) => module.EquipmentCreatePage,
  ),
);

export const EquipmentEditPage = lazyNamedPage(() =>
  import("../pages/EquipmentEditPage").then(
    (module) => module.EquipmentEditPage,
  ),
);

export const EquipmentPage = lazyNamedPage(() =>
  import("../pages/EquipmentPage").then((module) => module.EquipmentPage),
);

export const EquipmentViewPage = lazyNamedPage(() =>
  import("../pages/EquipmentViewPage").then(
    (module) => module.EquipmentViewPage,
  ),
);

export const MyChecklistsPage = lazyNamedPage(() =>
  import("../pages/my-checklists").then((module) => module.MyChecklistsPage),
);

export const MyChecklistViewPage = lazyNamedPage(() =>
  import("../pages/my-checklists").then((module) => module.MyChecklistViewPage),
);

export const ProfilePage = lazyNamedPage(() =>
  import("../pages/ProfilePage").then((module) => module.ProfilePage),
);

export const ProductionCalendarPage = lazyNamedPage(() =>
  import("../pages/ProductionCalendarPage").then(
    (module) => module.ProductionCalendarPage,
  ),
);

export const SearchPage = lazyNamedPage(() =>
  import("../pages/SearchPage").then((module) => module.SearchPage),
);

export const UsersPage = lazyNamedPage(() =>
  import("../pages/UsersPage").then((module) => module.UsersPage),
);
