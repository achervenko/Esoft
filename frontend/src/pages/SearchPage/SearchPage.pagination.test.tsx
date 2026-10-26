import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import * as api from "../../shared/api/search-api";
import { SearchPage } from "./SearchPage";
import { result, setupSearchPageTests } from "./search-page-test-utils";

setupSearchPageTests();
afterEach(() => vi.unstubAllGlobals());

it("appends the next page without removing existing rows", async () => {
  const first = Array.from({ length: 20 }, (_, id) => ({
    ...result(`насос ${id}`),
    id: String(id),
    entityId: id,
  }));
  const search = vi
    .spyOn(api, "searchApp")
    .mockResolvedValueOnce(first)
    .mockResolvedValueOnce([{ ...result("насос 20"), id: "20", entityId: 20 }]);
  render(<SearchPage />);
  const link = await screen.findByRole("link", { name: /насос 0/ });
  fireEvent.click(screen.getByRole("button", { name: "Показать ещё" }));
  expect(screen.getByRole("link", { name: /насос 0/ })).toBe(link);
  expect(await screen.findByText("насос 20")).toBeInTheDocument();
  expect(screen.getAllByRole("link")).toHaveLength(21);
  expect(search.mock.calls[1][0].offset).toBe(20);
});

it("keeps rows visible and shows a delayed loader below them during pagination", async () => {
  let resolve!: (items: api.SearchResultItem[]) => void;
  vi.spyOn(api, "searchApp")
    .mockResolvedValueOnce(
      Array.from({ length: 20 }, (_, id) => ({
        ...result(`насос ${id}`),
        id: String(id),
        entityId: id,
      })),
    )
    .mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
  const { container } = render(<SearchPage />);
  const link = await screen.findByRole("link", { name: /насос 0/ });
  await act(async () => {
    await new Promise((done) => setTimeout(done, 500));
  });
  fireEvent.click(screen.getByRole("button", { name: "Показать ещё" }));
  expect(screen.getByRole("link", { name: /насос 0/ })).toBe(link);
  const status = await screen.findByRole("status");
  expect(container.querySelector(".search-loading-footer")).toContainElement(
    status,
  );
  await act(async () => {
    resolve([]);
  });
  expect(screen.getByRole("link", { name: /насос 0/ })).toBe(link);
  await waitFor(() =>
    expect(screen.queryByRole("status")).not.toBeInTheDocument(),
  );
});

it("explains the pagination limit and stops requesting further pages", async () => {
  const search = vi
    .spyOn(api, "searchApp")
    .mockImplementation(async ({ offset = 0 }) =>
      Array.from({ length: 20 }, (_, index) => {
        const id = offset + index;
        return { ...result(`насос ${id}`), id: String(id), entityId: id };
      }),
    );
  render(<SearchPage />);
  await screen.findByText("насос 19");
  for (let offset = 20; offset <= 1000; offset += 20) {
    fireEvent.click(screen.getByRole("button", { name: "Показать ещё" }));
    await screen.findByText(`насос ${offset + 19}`);
  }
  expect(
    screen.getByText(/Показаны первые 1020 результатов/),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Показать ещё" }),
  ).not.toBeInTheDocument();
  expect(search.mock.calls.at(-1)?.[0].offset).toBe(1000);
}, 30000);

it("keeps matching IDs from different domains and removes duplicate composite identities", async () => {
  const first = Array.from({ length: 20 }, (_, index) => ({
    ...result(`насос ${index + 1}`),
    id: String(index + 1),
    entityId: index + 1,
  }));
  const ppe = {
    ...result("СИЗ с тем же ID"),
    id: "1",
    entityId: 1,
    entityType: "ppe_item",
    targetUrl: "#/ppe?itemId=1",
  };
  vi.spyOn(api, "searchApp")
    .mockResolvedValueOnce(first)
    .mockResolvedValueOnce([
      { ...first[0], id: "another-id", title: "Дубликат оборудования" },
      ppe,
      { ...ppe, id: "duplicate-id", title: "Дубликат СИЗ" },
      {
        ...result("Норма с тем же ID"),
        id: "1",
        entityId: 1,
        entityType: "ppe_norm",
        targetUrl: "#/ppe/positions/1",
      },
    ]);
  render(<SearchPage />);
  await screen.findByText("насос 20");
  fireEvent.click(screen.getByRole("button", { name: "Показать ещё" }));
  expect(await screen.findByText("СИЗ с тем же ID")).toBeInTheDocument();
  expect(screen.getByText("Норма с тем же ID")).toBeInTheDocument();
  expect(screen.getByText("насос 1")).toBeInTheDocument();
  expect(screen.queryByText("Дубликат оборудования")).not.toBeInTheDocument();
  expect(screen.queryByText("Дубликат СИЗ")).not.toBeInTheDocument();
  expect(screen.getAllByRole("link")).toHaveLength(22);
});

it.each(["observer-first", "button-first"])(
  "does not skip pages when observer and button race: %s",
  async (order) => {
    const callbacks: (() => void)[] = [];
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: IntersectionObserverCallback) {
          callbacks.push(() =>
            callback(
              [{ isIntersecting: true } as IntersectionObserverEntry],
              this as unknown as IntersectionObserver,
            ),
          );
        }
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    );
    const page = (offset: number) =>
      Array.from({ length: 20 }, (_, index) => ({
        ...result("насос " + (offset + index)),
        entityId: offset + index,
        id: String(offset + index),
      }));
    let resolve!: (items: api.SearchResultItem[]) => void;
    const next = new Promise<api.SearchResultItem[]>((done) => {
      resolve = done;
    });
    const search = vi
      .spyOn(api, "searchApp")
      .mockImplementation(async ({ offset = 0 }) =>
        offset === 0 ? page(0) : offset === 20 ? next : page(offset),
      );
    render(<SearchPage />);
    await screen.findByText("насос 19");
    await waitFor(() => expect(callbacks.length).toBeGreaterThan(0));
    const notify = callbacks.at(-1)!;
    const button = screen.getByRole("button", { name: "Показать ещё" });
    act(() => {
      if (order === "observer-first") {
        notify();
        fireEvent.click(button);
      } else {
        fireEvent.click(button);
        notify();
      }
    });
    await waitFor(() => expect(search).toHaveBeenCalledTimes(2));
    expect(search.mock.calls.map(([q]) => q.offset)).toEqual([0, 20]);
    await act(async () => resolve(page(20)));
    await screen.findByText("насос 39");
    // A disconnected observer may still deliver a queued callback from the old page.
    act(() => notify());
    expect(search).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("button", { name: "Показать ещё" }));
    await screen.findByText("насос 59");
    expect(search.mock.calls.map(([q]) => q.offset)).toEqual([0, 20, 40]);
  },
);
