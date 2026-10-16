import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { EmployeeIssueCard } from "./EmployeeIssueCard";
import { employee } from "./ppe-test-fixtures";

vi.mock("./EmployeeNorms", () => ({ EmployeeNorms: () => <div>Нормы</div> }));
vi.mock("./EmployeeIssueHistory", () => ({ EmployeeIssueHistory: () => <div>История выдачи</div> }));
afterEach(cleanup);

it("keeps one sizes section after repeated updates when employee and position IDs match", () => {
  const props = {
    employee: { ...employee, id: 5, positionId: 5 },
    allowed: false, backdate: false, on: "2026-10-13", revision: 0,
    role: "ppe_specialist", onChanged: vi.fn(), onExtraIssue: vi.fn(), onDateChange: vi.fn(),
  };
  const view = render(<EmployeeIssueCard {...props} />);
  for (let revision = 1; revision <= 8; revision++) {
    view.rerender(<EmployeeIssueCard {...props} revision={revision} employee={{ ...props.employee, shoeSize: 40 + revision }} />);
    expect(screen.getAllByText("Размеры сотрудника")).toHaveLength(1);
    expect(screen.getAllByText("Нормы")).toHaveLength(1);
    expect(screen.getAllByText("История выдачи")).toHaveLength(1);
    expect(screen.getByText(String(40 + revision))).toBeInTheDocument();
  }
});
