import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { IssuePlanTable } from "./IssuePlanTable";
import { plan, planRow } from "./ppe-test-fixtures";
afterEach(cleanup);
it("keeps selection independent for the same PPE in current and future norms", async () => {
  const current = { ...planRow, normItemId: 7, normEffectiveFrom: "2026-01-01" };
  const future = { ...planRow, normItemId: 8, normId: 6, normEffectiveFrom: "2026-11-01" };
  const onChoose = vi.fn();
  render(<ChakraProvider value={defaultSystem}><IssuePlanTable plan={{ ...plan, on: "2026-10-15" }} dueItems={[current, future]} allowed selected={[8]} hasSelection onChoose={onChoose} onIssue={vi.fn()} /></ChakraProvider>);
  expect(screen.getByText("Норма с 01.11.2026")).toBeInTheDocument();
  const choices = screen.getAllByRole("checkbox");
  expect(choices[0]).not.toBeChecked();
  expect(choices[1]).toBeChecked();
  fireEvent.click(choices[0]);
  await waitFor(() => expect(onChoose).toHaveBeenCalledWith(current, true));
});
it.each([
  ["NOT_AVAILABLE", "Ещё рано", false],
  ["EARLY", "Можно выдать", true],
  ["DUE", "К выдаче", true],
  ["OVERDUE", "Просрочено", true],
] as const)("shows obligation status %s and explains its dates", (status, label, available) => {
  const row = { ...planRow, plannedDate: "2026-11-10", availableFrom: "2026-10-11", obligationStatus: status,
    available: available ? { scheduledAt: "2026-11-10", quantity: 2 } : null,
    nextFuture: { scheduledAt: "2026-11-10", quantity: 2 }, overdue: status === "OVERDUE" ? 1 : 0 };
  render(<ChakraProvider value={defaultSystem}><IssuePlanTable plan={plan} dueItems={[row]} allowed={false} selected={[]} hasSelection={false} onChoose={vi.fn()} onIssue={vi.fn()} /></ChakraProvider>);
  expect(screen.getByText(label)).toBeInTheDocument();
  expect(screen.getByText("10.11.2026")).toBeInTheDocument();
  expect(screen.getByText("Можно выдать с 11.10.2026")).toBeInTheDocument();
});
