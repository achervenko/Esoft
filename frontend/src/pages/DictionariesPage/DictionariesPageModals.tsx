import { EmployeeSizesModal } from "./EmployeeSizesModal";
import { NameDictionaryFormModal } from "./NameDictionaryFormModal";
import { EmployeeDictionaryFormModal } from "./EmployeeDictionaryFormModal";
import { CountryFormModal } from "./CountryFormModal";
import { ParentNameDictionaryFormModal } from "./ParentNameDictionaryFormModal";
import type { DictionariesModalsModel } from "./dictionaries-page-view.types";

type DictionariesPageModalsProps = {
  page: DictionariesModalsModel;
  sizeEmployeeId: number | null;
  onCloseEmployeeSizes: () => void;
  onEmployeeSizesChanged?: () => void;
};

export function DictionariesPageModals({
  page,
  sizeEmployeeId,
  onCloseEmployeeSizes,
  onEmployeeSizesChanged,
}: DictionariesPageModalsProps) {
  return (
    <>
      {sizeEmployeeId !== null && (
        <EmployeeSizesModal
          id={sizeEmployeeId}
          onClose={onCloseEmployeeSizes}
          onChanged={onEmployeeSizesChanged}
        />
      )}
      {page.positionForm ? (
        <NameDictionaryFormModal
          item={page.positionForm === "new" ? null : page.positionForm}
          isSaving={page.isSaving}
          maxLength={64}
          onClose={() => page.setPositionForm(null)}
          onSubmit={(payload) => void page.savePosition(payload)}
          title={
            page.positionForm === "new"
              ? "Новая должность"
              : "Редактирование должности"
          }
        />
      ) : null}
      {page.employeeForm ? (
        <EmployeeDictionaryFormModal
          employee={page.employeeForm === "new" ? null : page.employeeForm}
          positions={page.positions}
          isSaving={page.isSaving}
          onClose={() => page.setEmployeeForm(null)}
          onSubmit={page.saveEmployee}
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
    </>
  );
}
