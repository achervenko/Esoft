import { Plus } from "lucide-react";
import "../../shared/ui/AdminPage.css";
import { Notice } from "../../shared/ui/Notice";
import { CountriesTable } from "./CountriesTable";
import { CountryFormModal } from "./CountryFormModal";
import { DictionaryEmployeesTable } from "./DictionaryEmployeesTable";
import { EmployeeDictionaryFormModal } from "./EmployeeDictionaryFormModal";
import { LocationsDictionaryPanel } from "./LocationsDictionaryPanel";
import { ManufacturersDictionaryPanel } from "./ManufacturersDictionaryPanel";
import { NameDictionaryFormModal } from "./NameDictionaryFormModal";
import { ParentNameDictionaryFormModal } from "./ParentNameDictionaryFormModal";
import {
  useDictionariesAdminPage,
  type ActiveDictionariesTab,
} from "./useDictionariesAdminPage";

type DictionariesPageProps = {
  userRole: string | null;
};

const tabLabels: Record<ActiveDictionariesTab, string> = {
  employees: "Сотрудники",
  manufacturers: "Производители",
  countries: "Страны",
  locations: "Местонахождения",
};

const addButtonLabels: Record<ActiveDictionariesTab, string> = {
  employees: "Добавить",
  manufacturers: "Добавить",
  countries: "Добавить",
  locations: "Добавить",
};

export function DictionariesPage({ userRole }: DictionariesPageProps) {
  const page = useDictionariesAdminPage({ userRole });

  if (!page.isAdmin) {
    return (
      <section className="admin-page dictionaries-page">
        <Notice tone="error">
          Недостаточно прав для управления справочниками.
        </Notice>
      </section>
    );
  }

  const openCreateForm = () => {
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
        <header>
          <h2>{tabLabels[page.activeTab]}</h2>
          {page.activeTab !== "locations" &&
          page.activeTab !== "manufacturers" ? (
            <button
              className="admin-primary-button"
              onClick={openCreateForm}
              type="button"
            >
              <Plus size={18} />
              {addButtonLabels[page.activeTab]}
            </button>
          ) : null}
        </header>

        {page.isLoading ? <p className="admin-state">Загрузка...</p> : null}
        {!page.isLoading && page.activeTab === "employees" ? (
          <DictionaryEmployeesTable
            employees={page.employees}
            onEdit={page.setEmployeeForm}
            onToggleStatus={(employee) =>
              void page.toggleEmployeeStatus(employee)
            }
          />
        ) : null}
        {!page.isLoading && page.activeTab === "manufacturers" ? (
          <ManufacturersDictionaryPanel
            manufacturers={page.manufacturers}
            models={page.models}
            onCreateManufacturer={() => page.setManufacturerForm("new")}
            onCreateModel={() => page.setModelForm("new")}
            onDeleteManufacturer={(manufacturer) =>
              void page.removeManufacturer(manufacturer)
            }
            onDeleteModel={(model) => void page.removeModel(model)}
            onEditManufacturer={page.setManufacturerForm}
            onEditModel={page.setModelForm}
          />
        ) : null}
        {!page.isLoading && page.activeTab === "countries" ? (
          <CountriesTable
            countries={page.countries}
            onDelete={(country) => void page.removeCountry(country)}
            onEdit={page.setCountryForm}
          />
        ) : null}
        {!page.isLoading && page.activeTab === "locations" ? (
          <LocationsDictionaryPanel
            locations={page.locations}
            objects={page.objects}
            onCreateLocation={() => page.setLocationForm("new")}
            onCreateObject={() => page.setObjectForm("new")}
            onDeleteLocation={(location) => void page.removeLocation(location)}
            onDeleteObject={(object) => void page.removeObject(object)}
            onEditLocation={page.setLocationForm}
            onEditObject={page.setObjectForm}
          />
        ) : null}
      </section>

      {page.employeeForm ? (
        <EmployeeDictionaryFormModal
          employee={page.employeeForm === "new" ? null : page.employeeForm}
          isSaving={page.isSaving}
          onClose={() => page.setEmployeeForm(null)}
          onSubmit={(payload) => void page.saveEmployee(payload)}
        />
      ) : null}

      {page.manufacturerForm ? (
        <NameDictionaryFormModal
          isSaving={page.isSaving}
          item={page.manufacturerForm === "new" ? null : page.manufacturerForm}
          onClose={() => page.setManufacturerForm(null)}
          onSubmit={(payload) => void page.saveManufacturer(payload)}
          title={
            page.manufacturerForm === "new"
              ? "Новый производитель"
              : "Редактирование производителя"
          }
        />
      ) : null}

      {page.countryForm ? (
        <CountryFormModal
          country={page.countryForm === "new" ? null : page.countryForm}
          isSaving={page.isSaving}
          onClose={() => page.setCountryForm(null)}
          onSubmit={(payload) => void page.saveCountry(payload)}
        />
      ) : null}

      {page.objectForm ? (
        <NameDictionaryFormModal
          isSaving={page.isSaving}
          item={page.objectForm === "new" ? null : page.objectForm}
          onClose={() => page.setObjectForm(null)}
          onSubmit={(payload) => void page.saveObject(payload)}
          title={
            page.objectForm === "new"
              ? "Новый объект"
              : "Редактирование объекта"
          }
        />
      ) : null}

      {page.locationForm ? (
        <ParentNameDictionaryFormModal
          initialName={
            page.locationForm === "new" ? "" : page.locationForm.name
          }
          initialParentId={
            page.locationForm === "new" ? null : page.locationForm.workshopId
          }
          isSaving={page.isSaving}
          nameLabel="Местонахождение"
          onClose={() => page.setLocationForm(null)}
          onSubmit={(payload) =>
            void page.saveLocation({
              name: payload.name,
              objectId: payload.parentId,
            })
          }
          parentLabel="Объект"
          parentOptions={page.objects}
          title={
            page.locationForm === "new"
              ? "Новое местонахождение"
              : "Редактирование местонахождения"
          }
        />
      ) : null}

      {page.modelForm ? (
        <ParentNameDictionaryFormModal
          initialName={page.modelForm === "new" ? "" : page.modelForm.name}
          initialParentId={
            page.modelForm === "new" ? null : page.modelForm.manufacturerId
          }
          isSaving={page.isSaving}
          nameLabel="Модель"
          onClose={() => page.setModelForm(null)}
          onSubmit={(payload) =>
            void page.saveModel({
              name: payload.name,
              manufacturerId: payload.parentId,
            })
          }
          parentLabel="Производитель"
          parentOptions={page.manufacturers}
          title={
            page.modelForm === "new" ? "Новая модель" : "Редактирование модели"
          }
        />
      ) : null}
    </section>
  );
}
