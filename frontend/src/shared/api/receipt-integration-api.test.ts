import { beforeEach, expect, it, vi } from "vitest";
import { request } from "./api-client";
import { receiptIntegrationApi } from "./receipt-integration-api";
import { receiptIntegrationWarehousesApi } from "./receipt-integration-warehouses-api";
vi.mock("./api-client", () => ({ request: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
it("uses the warehouse domain API for administrative warehouse links", async () => {
  const body = { externalId: "guid", warehouseId: "10" };
  await receiptIntegrationWarehousesApi.save("source/code", body);
  expect(request).toHaveBeenCalledExactlyOnceWith(
    "/api/warehouse/integrations/sources/source%2Fcode/warehouses",
    {
      method: "PUT",
      body: JSON.stringify(body),
    },
  );
});
it.each([undefined, "source/code"])(
  "saves source and flows using one request (code=%s)",
  async (code) => {
    const saved = { code: "saved" };
    vi.mocked(request).mockResolvedValue(saved);
    const settings = {
      code,
      name: "Source",
      baseUrl: "http://example.test/",
      authorization: "",
      isActive: true,
      flows: [
        {
          flowCode: "warehouse.receipts",
          configVersion: 1,
          config: {},
          isActive: false,
          lastSuccessAt: null,
          lastErrorAt: null,
          lastErrorCode: null,
        },
      ],
    };
    await expect(receiptIntegrationApi.configure(settings)).resolves.toEqual(
      saved,
    );
    expect(request).toHaveBeenCalledExactlyOnceWith(
      code
        ? "/api/integrations/sources/source%2Fcode"
        : "/api/integrations/sources",
      {
        method: code ? "PATCH" : "POST",
        body: JSON.stringify({
          name: settings.name,
          baseUrl: settings.baseUrl,
          authorization: "",
          isActive: true,
          ...(!code ? { systemType: "ONE_C" } : {}),
          flows: [
            {
              flowCode: "warehouse.receipts",
              configVersion: 1,
              config: {},
              isActive: false,
            },
          ],
        }),
      },
    );
  },
);
