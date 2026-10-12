import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { usePdfViewer } from "./usePdfViewer";

it("indexes a document only when search is opened and reuses its index", async () => {
  const indexDocument = vi.fn().mockResolvedValue(undefined);
  const resetSearch = vi.fn();
  const renderText = (text: string) => text;
  const document = { numPages: 1000, getPage: vi.fn() };
  const hook = renderHook(({ searchOpen }) => usePdfViewer({
    fileUrl: "/document.pdf", searchOpen, indexDocument, resetSearch, renderText,
  }), { initialProps: { searchOpen: false } });
  act(() => hook.result.current.handleDocumentLoadSuccess(document));
  expect(indexDocument).not.toHaveBeenCalled();
  hook.rerender({ searchOpen: true });
  await waitFor(() => expect(indexDocument).toHaveBeenCalledExactlyOnceWith(document));
  hook.rerender({ searchOpen: false });
  hook.rerender({ searchOpen: true });
  expect(indexDocument).toHaveBeenCalledOnce();
  hook.unmount();
});
