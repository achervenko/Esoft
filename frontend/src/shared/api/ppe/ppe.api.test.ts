import { afterEach, expect, it, vi } from "vitest";
import { request } from "../api-client";
import { ppeApi } from "./ppe.api";
vi.mock("../api-client", () => ({ request: vi.fn().mockResolvedValue([]) }));
afterEach(() => vi.clearAllMocks());
it("combines journal filters and omits empty parameters", async () => {
  await ppeApi.journal({
    employeeId: "1",
    status: "CANCELLED",
    dateFrom: "2026-01-01",
    dateTo: "",
  });
  expect(request).toHaveBeenCalledWith(
    "/api/ppe/issues?employeeId=1&status=CANCELLED&dateFrom=2026-01-01",
    { signal: undefined },
  );
});
it("omits issuedAt from specialist plan queries and supports the admin historical plan", async () => {
  await ppeApi.plan(1);
  expect(request).toHaveBeenLastCalledWith("/api/ppe/employees/1/issues/plan", {
    signal: undefined,
  });
  await ppeApi.plan(1, "2026-01-01");
  expect(request).toHaveBeenLastCalledWith(
    "/api/ppe/employees/1/issues/plan?issuedAt=2026-01-01",
    { signal: undefined },
  );
});
it("uses the full revision endpoint without adding positionId to its body", async () => {
  const payload = {
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    items: [
      {
        ppeItemId: 1,
        quantity: 1,
        periodCount: 1,
        periodUnit: "YEAR" as const,
      },
    ],
  };
  await ppeApi.saveNorm("revision", 7, 2, payload);
  expect(request).toHaveBeenCalledWith("/api/ppe/norms/7/revision", {
    method: "POST",
    body: JSON.stringify(payload),
  });
});
