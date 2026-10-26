import { useMediaQuery } from "../../shared/lib/useMediaQuery";
import { StorageLocationsPanel } from "./StorageLocationsPanel";
import { hasPermission } from "../../shared/lib/permissions";
import { DictionariesPageContent } from "./DictionariesPageContent";
import { DictionariesPageModals } from "./DictionariesPageModals";
import { useEffect, useRef, useState } from "react";
import { canManageEmployeeSizes } from "../../modules/ppe-permissions/ppe-permissions";
import { PpeEmployeesPanel } from "./PpeEmployeesPanel";
import { usePpeQuery } from "../../modules/ppe-ui/usePpeQuery";
import { ppeApi } from "../../shared/api/ppe";
import { Plus } from "lucide-react";
import "../../shared/ui/AdminPage.css";
import "./DictionariesPage.css";
import { Notice } from "../../shared/ui/Notice";
import { useDictionariesAdminPage } from "./useDictionariesAdminPage";

type DictionariesPageProps = {
  userPermissions: readonly string[] | null;
};

export function DictionariesPage({ userPermissions }: DictionariesPageProps) {
  const page = useDictionariesAdminPage({ userPermissions });
  const storageManageable = hasPermission(
    userPermissions,
    "warehouse.storage-locations.manage",
  );
  const isMobile = useMediaQuery("(max-width: 760px)");
  const tabsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isMobile) {
      tabsRef.current
        ?.querySelector<HTMLElement>('[aria-selected="true"]')
        ?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    }
  }, [page.activeTab, isMobile]);
  const [newParentId, setNewParentId] = useState<number | null>(null);
  const [sizeEmployeeId, setSizeEmployeeId] = useState<number | null>(null);
  const sizes = usePpeQuery(
    "dictionary-employee-sizes",
    (signal) => ppeApi.employees(signal),
    page.dictionariesManageable &&
      canManageEmployeeSizes(userPermissions) &&
      page.activeTab === "employees" &&
      page.employees.length > 0,
  );
  const employeeSizes = sizes.data
    ? new Map(sizes.data.map((employee) => [employee.id, employee.ppeSizes]))
    : undefined;

  if (!page.availableTabs.length) {
    return (
      <section className="admin-page dictionaries-page">
        <Notice tone="error">
          Недостаточно прав для управления справочниками.
        </Notice>
      </section>
    );
  }

  const openCreateForm = () => {
    if (page.activeTab === "positions") page.setPositionForm("new");
    else if (page.activeTab === "countries") page.setCountryForm("new");
  };

  return (
    <section className="admin-page dictionaries-page">
      <header className="admin-page-header dictionaries-page-header">
        <h1>Справочники</h1>
      </header>

      <div
        className="equipment-edit-tabs admin-tabs"
        role="tablist"
        ref={tabsRef}
      >
        {page.availableTabs.map(({ id, label }) => (
          <button
            type="button"
            key={id}
            role="tab"
            aria-selected={page.activeTab === id}
            className={page.activeTab === id ? "active" : undefined}
            onClick={() => page.setActiveTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {page.activeTab === "storageLocations" ? (
        <StorageLocationsPanel canManage={storageManageable} />
      ) : !page.dictionariesManageable ? (
        <PpeEmployeesPanel embedded />
      ) : (
        <>
          <section className="admin-card dictionaries-card">
            {page.activeTab !== "locations" &&
            page.activeTab !== "employees" &&
            page.activeTab !== "manufacturers" ? (
              <header className="admin-card-actions-header">
                <button
                  className="admin-primary-button"
                  onClick={openCreateForm}
                  type="button"
                >
                  <Plus size={18} />
                  Добавить
                </button>
              </header>
            ) : null}

            <div
              className={`dictionaries-content${page.activeTab === "positions" || page.activeTab === "countries" ? " dictionary-table-surface" : ""}`}
            >
              {page.error && (
                <Notice tone="error">
                  {page.error}
                  <button
                    className="admin-secondary-button"
                    type="button"
                    onClick={page.retry}
                  >
                    Повторить загрузку
                  </button>
                </Notice>
              )}
              {sizes.error && (
                <Notice tone="error">
                  Не удалось проверить заполненность размеров: {sizes.error}
                </Notice>
              )}
              <DictionariesPageContent
                onCreateModel={(parentId) => {
                  setNewParentId(parentId);
                  page.setModelForm("new");
                }}
                onCreateLocation={(parentId) => {
                  setNewParentId(parentId);
                  page.setLocationForm("new");
                }}
                employeeSizes={employeeSizes}
                page={{
                  activeTab: page.activeTab,
                  countries: page.countries,
                  employees: page.employees,
                  isLoading: page.isLoading,
                  isSaving: page.isSaving,
                  locations: page.locations,
                  manufacturers: page.manufacturers,
                  models: page.models,
                  objects: page.objects,
                  positions: page.positions,
                  removeCountry: page.removeCountry,
                  removeLocation: page.removeLocation,
                  removeManufacturer: page.removeManufacturer,
                  removeModel: page.removeModel,
                  removeObject: page.removeObject,
                  setCountryForm: page.setCountryForm,
                  setEmployeeForm: page.setEmployeeForm,
                  setLocationForm: page.setLocationForm,
                  setManufacturerForm: page.setManufacturerForm,
                  setModelForm: page.setModelForm,
                  setObjectForm: page.setObjectForm,
                  setPositionForm: page.setPositionForm,
                  toggleEmployeeStatus: page.toggleEmployeeStatus,
                  togglePositionStatus: page.togglePositionStatus,
                }}
                userPermissions={userPermissions}
                onOpenEmployeeSizes={setSizeEmployeeId}
              />
            </div>
          </section>

          <DictionariesPageModals
            page={{
              countryForm: page.countryForm,
              employeeForm: page.employeeForm,
              isSaving: page.isSaving,
              locationForm: page.locationForm,
              manufacturerForm: page.manufacturerForm,
              manufacturers: page.manufacturers,
              modelForm: page.modelForm,
              objectForm: page.objectForm,
              objects: page.objects,
              positionForm: page.positionForm,
              positions: page.positions,
              saveCountry: page.saveCountry,
              saveEmployee: async (payload) => {
                await page.saveEmployee(payload);
                if (page.employeeForm === "new") sizes.reload();
              },
              saveLocation: page.saveLocation,
              saveManufacturer: page.saveManufacturer,
              saveModel: page.saveModel,
              saveObject: page.saveObject,
              savePosition: page.savePosition,
              setCountryForm: page.setCountryForm,
              setEmployeeForm: page.setEmployeeForm,
              setLocationForm: page.setLocationForm,
              setManufacturerForm: page.setManufacturerForm,
              setModelForm: page.setModelForm,
              setObjectForm: page.setObjectForm,
              setPositionForm: page.setPositionForm,
            }}
            newParentId={newParentId}
            sizeEmployeeId={sizeEmployeeId}
            onCloseEmployeeSizes={() => setSizeEmployeeId(null)}
            onEmployeeSizesChanged={sizes.reload}
          />
        </>
      )}
    </section>
  );
}
