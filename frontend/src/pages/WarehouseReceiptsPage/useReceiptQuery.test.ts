import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useReceiptQuery } from "./useReceiptQuery";
it("keeps the receipt mounted during refresh, including a failed refresh, but clears it when identity changes", async () => {
  let resolveRefresh!: (value: string) => void;
  const load = vi
    .fn()
    .mockResolvedValueOnce("original")
    .mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          resolveRefresh = resolve;
        }),
    )
    .mockRejectedValueOnce(Error("offline"))
    .mockImplementationOnce(() => new Promise(() => {}));
  const { result, rerender } = renderHook(
    ({ id }) => useReceiptQuery<string>(load, [id]),
    { initialProps: { id: "1" } },
  );
  await waitFor(() => expect(result.current.data).toBe("original"));
  act(() => result.current.reload());
  expect(result.current.data).toBe("original");
  expect(result.current.loading).toBe(true);
  await act(async () => resolveRefresh("updated"));
  expect(result.current.data).toBe("updated");
  act(() => result.current.reload());
  await waitFor(() => expect(result.current.error).toBeTruthy());
  expect(result.current.data).toBe("updated");
  rerender({ id: "2" });
  expect(result.current.data).toBeNull();
});
