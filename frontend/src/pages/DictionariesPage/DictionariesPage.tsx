import { DictionariesPageContent } from "./DictionariesPageContent";
import { DictionariesPageModals } from "./DictionariesPageModals";
import { useState } from "react";
import { canManageEmployeeSizes } from "../../modules/ppe-permissions/ppe-permissions";
import { PpeEmployeesPanel } from "./PpeEmployeesPanel";
import { Plus } from "lucide-react";
import "../../shared/ui/AdminPage.css";
import { Notice } from "../../shared/ui/Notice";
import {
  useDictionariesAdminPage,
  type ActiveDictionariesTab,
} from "./useDictionariesAdminPage";

type DictionariesPageProps = {
  userPermissions: readonly string[] | null;
};

const tabLabels: Record<ActiveDictionariesTab, string> = {
  employees: "Сотрудники",
  positions: "Должности",
  manufacturers: "Производители",
  countries: "Страны",
  locations: "Местонахождения",
};

const addButtonLabels: Record<ActiveDictionariesTab, string> = {
  employees: "Добавить",
  positions: "Добавить",
  manufacturers: "Добавить",
  countries: "Добавить",
  locations: "Добавить",
};

export function DictionariesPage({ userPermissions }: DictionariesPageProps) {
  const page = useDictionariesAdminPage({ userPermissions });
  const [sizeEmployeeId, setSizeEmployeeId] = useState<number | null>(null);

  if (!page.dictionariesManageable) {
    if (canManageEmployeeSizes(userPermissions)) return <PpeEmployeesPanel />;
    return (
      <section className="admin-page dictionaries-page">
        <Notice tone="error">
          Недостаточно прав для управления справочниками.
        </Notice>
      </section>
    );
  }

  const openCreateForm = () => {
    if (page.activeTab === "positions") {
      page.setPositionForm("new");
      return;
    }
    if (page.activeTab === "employees") {
      page.setEmployeeForm("new");
      return;
    }

    if (page.activeTab === "manufacturers") {
      page.setManufacturerForm("new");
      return;
    }

    if (page.activeTab === "locations") {
      page.setLocationForm("new");
      return;
    }

    page.setCountryForm("new");
  };

  return (
    <section className="admin-page dictionaries-page">
      <header className="admin-page-header dictionaries-page-header">
        <h1>Справочники</h1>
      </header>

      <div className="equipment-edit-tabs admin-tabs" role="tablist">
        {Object.entries(tabLabels).map(([tab, label]) => (
          <button
            aria-selected={page.activeTab === tab}
            className={page.activeTab === tab ? "active" : undefined}
            key={tab}
            onClick={() => page.setActiveTab(tab as ActiveDictionariesTab)}
            role="tab"
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      <section className="admin-card dictionaries-card">
        {page.activeTab !== "locations" &&
        page.activeTab !== "manufacturers" ? (
          <header className="admin-card-actions-header">
            <button
              className="admin-primary-button"
              onClick={openCreateForm}
              type="button"
            >
              <Plus size={18} />
              {addButtonLabels[page.activeTab]}
            </button>
          </header>
        ) : null}

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
        <DictionariesPageContent
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
          saveEmployee: page.saveEmployee,
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
        sizeEmployeeId={sizeEmployeeId}
        onCloseEmployeeSizes={() => setSizeEmployeeId(null)}
      />
    </section>
  );
}
