import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { vi } from "vitest";
import type { EmployeeSizes } from "../../shared/api/ppe";
import type { AdminEmployee } from "../../shared/api/users-admin-api";
import { DictionaryEmployeesTable } from "./DictionaryEmployeesTable";

export const employee: AdminEmployee = {
  id: 1,
  firstName: "Иван",
  lastName: "Иванов",
  middleName: null,
  fullName: "Иван Иванов",
  gender: null,
  position: "Инженер",
  positionId: 1,
  isActive: true,
  isLinkedToCurrentUser: false,
  hasUserAccounts: false,
  accountCount: 0,
  activeAccountCount: 0,
  equipmentCount: 0,
};

export const complete: EmployeeSizes = {
  clothingSize: "48",
  clothingHeight: "176",
  tshirtSize: "48",
  tshirtHeight: "176",
  shoeSize: 42,
  gloveSize: "9",
  headwearSize: "58",
};

export function renderEmployees(
  employees: AdminEmployee[] = [employee],
  overrides: Partial<ComponentProps<typeof DictionaryEmployeesTable>> = {},
) {
  return render(
    <DictionaryEmployeesTable
      employees={employees}
      onEdit={vi.fn()}
      onToggleStatus={vi.fn()}
      {...overrides}
    />,
    {
      wrapper: ({ children }) => (
        <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
      ),
    },
  );
}

export function mockViewport(mobile = false) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string): MediaQueryList => ({
      matches: query === "(max-width: 760px)" ? mobile : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    })),
  );
}

export function mobileViewport() {
  mockViewport(true);
}

export function openEmployeeCard(fullName = employee.fullName) {
  fireEvent.click(
    screen.getByRole("button", {
      name: `Открыть карточку сотрудника ${fullName}`,
    }),
  );
}

export function searchEmployee(value: string) {
  fireEvent.change(
    screen.getByRole("searchbox", { name: "Поиск сотрудников" }),
    {
      target: { value },
    },
  );
}
