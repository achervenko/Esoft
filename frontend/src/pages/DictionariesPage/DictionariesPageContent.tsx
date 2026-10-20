import { LoadingIndicator } from "../../shared/ui/LoadingIndicator";
import { canManageEmployeeSizes } from "../../modules/ppe-permissions/ppe-permissions";
import { PositionsDictionaryPanel } from "./PositionsDictionaryPanel";
import { DictionaryEmployeesTable } from "./DictionaryEmployeesTable";
import { ManufacturersDictionaryPanel } from "./ManufacturersDictionaryPanel";
import { CountriesTable } from "./CountriesTable";
import { LocationsDictionaryPanel } from "./LocationsDictionaryPanel";
import type { DictionariesContentModel } from "./dictionaries-page-view.types";
import type { EmployeeSizes } from "../../shared/api/ppe";

type DictionariesPageContentProps = {
  page: DictionariesContentModel;
  userPermissions: readonly string[] | null;
  onOpenEmployeeSizes: (id: number) => void;
  employeeSizes?: ReadonlyMap<number, EmployeeSizes | null>;
};

export function DictionariesPageContent({
  page,
  userPermissions,
  onOpenEmployeeSizes,
  employeeSizes,
}: DictionariesPageContentProps) {
  return (
    <>
      <LoadingIndicator loading={page.isLoading} />
      {!page.isLoading && page.activeTab === "positions" ? (
        <PositionsDictionaryPanel
          positions={page.positions}
          isSaving={page.isSaving}
          onEdit={page.setPositionForm}
          onToggleStatus={(item) => void page.togglePositionStatus(item)}
        />
      ) : null}
      {(!page.isLoading || page.employees.length > 0) &&
      page.activeTab === "employees" ? (
        <DictionaryEmployeesTable
          employees={page.employees}
          employeeSizes={employeeSizes}
          isSaving={page.isSaving}
          onSizes={
            canManageEmployeeSizes(userPermissions)
              ? (employee) => onOpenEmployeeSizes(employee.id)
              : undefined
          }
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
    </>
  );
}
