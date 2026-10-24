import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DictionariesPageModals } from "./DictionariesPageModals";
import type { DictionariesModalsModel } from "./dictionaries-page-view.types";

afterEach(cleanup);

const parents = [{ id: 1, name: "Первый" }, { id: 2, name: "Второй" }];
function page(): DictionariesModalsModel {
  return {
    isSaving: false, positions: [], manufacturers: parents, objects: parents,
    countryForm: null, employeeForm: null, locationForm: null, manufacturerForm: null,
    modelForm: null, objectForm: null, positionForm: null,
    setCountryForm: vi.fn(), setEmployeeForm: vi.fn(), setLocationForm: vi.fn(),
    setManufacturerForm: vi.fn(), setModelForm: vi.fn(), setObjectForm: vi.fn(), setPositionForm: vi.fn(),
    saveCountry: vi.fn(async () => {}), saveEmployee: vi.fn(async () => {}),
    saveLocation: vi.fn(async () => {}), saveManufacturer: vi.fn(async () => {}),
    saveModel: vi.fn(async () => {}), saveObject: vi.fn(async () => {}), savePosition: vi.fn(async () => {}),
  };
}

it.each(["model", "location"] as const)("prefills a new %s with the selected parent", (kind) => {
  const state = page();
  if (kind === "model") state.modelForm = "new";
  else state.locationForm = "new";
  render(<DictionariesPageModals page={state} sizeEmployeeId={null}
    newParentId={2} onCloseEmployeeSizes={vi.fn()} />);
  expect(screen.getByRole("button", { name: kind === "model" ? /Производитель/ : /Объект/ }))
    .toHaveTextContent("Второй");
});

it.each(["model", "location"] as const)("keeps the existing parent while editing a %s", (kind) => {
  const state = page();
  if (kind === "model") state.modelForm = { id: 1, name: "Модель", manufacturerId: 1, manufacturer: parents[0] };
  else state.locationForm = { id: 1, name: "Участок", workshopId: 1, workshop: parents[0] };
  render(<DictionariesPageModals page={state} sizeEmployeeId={null}
    newParentId={2} onCloseEmployeeSizes={vi.fn()} />);
  expect(screen.getByRole("button", { name: kind === "model" ? /Производитель/ : /Объект/ }))
    .toHaveTextContent("Первый");
});
