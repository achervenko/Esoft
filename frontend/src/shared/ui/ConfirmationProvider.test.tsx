import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ConfirmationProvider } from "./ConfirmationProvider";
import { useConfirmation } from "./useConfirmation";
import { createCountryDictionaryActions } from "../../pages/DictionariesPage/country-dictionary-actions";
import * as api from "../api/dictionaries-admin-api";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function CountryAction() {
  const confirm = useConfirmation();
  const { removeCountry } = createCountryDictionaryActions({
    confirm,
    countryForm: null,
    loadData: async () => {},
    runSavingAction: (action) => action(),
    setCountryForm: vi.fn(),
    setMessage: vi.fn(),
  });
  return (
    <button
      onClick={() => void removeCountry({ id: 1, name: "Россия", iso: "RU" })}
    >
      Удалить страну
    </button>
  );
}
it("does not delete on cancellation and deletes once after confirmation", async () => {
  const remove = vi
    .spyOn(api, "deleteDictionaryCountry")
    .mockResolvedValue({ ok: true });
  render(
    <ConfirmationProvider>
      <CountryAction />
    </ConfirmationProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Удалить страну" }));
  expect(remove).not.toHaveBeenCalled();
  expect(screen.getByText("Удалить страну «Россия»?")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Назад" }));
  expect(remove).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Удалить страну" }));
  fireEvent.click(screen.getByRole("button", { name: "Удалить" }));
  await waitFor(() => expect(remove).toHaveBeenCalledExactlyOnceWith(1));
});
it("cancels pending confirmation on route change", async () => {
  const remove = vi
    .spyOn(api, "deleteDictionaryCountry")
    .mockResolvedValue({ ok: true });
  render(
    <ConfirmationProvider>
      <CountryAction />
    </ConfirmationProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Удалить страну" }));
  await act(async () =>
    window.dispatchEvent(new HashChangeEvent("hashchange")),
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(remove).not.toHaveBeenCalled();
});
