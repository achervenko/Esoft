import { afterEach, describe, beforeEach, expect, it, vi } from "vitest";
import { authClient } from "../../lib/auth-client";
import { getUserProfile } from "./user-profile-api";
import { getAuthenticatedUser, waitForAuthenticatedUser } from "./auth-session";
vi.mock("../../lib/auth-client", () => ({
  authClient: { getSession: vi.fn() },
}));
vi.mock("./user-profile-api", () => ({ getUserProfile: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
it("uses session permissions even when profile enrichment returns other permissions", async () => {
  vi.mocked(authClient.getSession).mockResolvedValue({
    data: {
      session: { id: "s" },
      user: { id: "u", role: "engineer", permissions: ["equipment.read"] },
    },
  } as never);
  vi.mocked(getUserProfile).mockResolvedValue({
    id: "u",
    employee: null,
    photo: null,
    permissions: ["users.manage"],
  });
  expect((await getAuthenticatedUser())?.permissions).toEqual([
    "equipment.read",
  ]);
});
it("keeps permissions when profile enrichment fails", async () => {
  vi.mocked(authClient.getSession).mockResolvedValue({
    data: {
      session: { id: "s" },
      user: {
        id: "u",
        role: "storekeeper",
        permissions: ["warehouse.catalog.manage"],
      },
    },
  } as never);
  vi.mocked(getUserProfile).mockRejectedValue(new Error("offline"));
  expect((await getAuthenticatedUser())?.permissions).toEqual([
    "warehouse.catalog.manage",
  ]);
});
it("does not infer grants from an admin role when the API omits permissions", async () => {
  vi.mocked(authClient.getSession).mockResolvedValue({
    data: { session: { id: "s" }, user: { id: "u", role: "admin" } },
  } as never);
  vi.mocked(getUserProfile).mockResolvedValue({
    id: "u",
    employee: null,
    photo: null,
    permissions: ["users.manage"],
  });
  expect((await getAuthenticatedUser())?.permissions).toEqual([]);
});

describe("waiting for authenticated session", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  it("recovers from a session request failure and a temporarily absent session", async () => {
    vi.mocked(authClient.getSession)
      .mockRejectedValueOnce(new Error("Temporary network failure"))
      .mockResolvedValueOnce({ data: null } as never)
      .mockResolvedValueOnce({
        data: {
          session: { id: "s" },
          user: { id: "u", permissions: ["equipment.read"] },
        },
      } as never);
    vi.mocked(getUserProfile).mockRejectedValue(
      new Error("Profile unavailable"),
    );
    const assertion = expect(waitForAuthenticatedUser()).resolves.toMatchObject(
      { id: "u", permissions: ["equipment.read"] },
    );
    await vi.runAllTimersAsync();
    await assertion;
    expect(authClient.getSession).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("throws the last request error only after all eight attempts", async () => {
    const last = new Error("Final failure");
    vi.mocked(authClient.getSession).mockRejectedValue(
      new Error("Temporary failure"),
    );
    vi.mocked(authClient.getSession).mockRejectedValueOnce(
      new Error("First failure"),
    );
    for (let i = 0; i < 6; i++)
      vi.mocked(authClient.getSession).mockRejectedValueOnce(
        new Error("Intermediate failure"),
      );
    vi.mocked(authClient.getSession).mockRejectedValueOnce(last);
    const assertion = expect(waitForAuthenticatedUser()).rejects.toBe(last);
    await vi.runAllTimersAsync();
    await assertion;
    expect(authClient.getSession).toHaveBeenCalledTimes(8);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("keeps the session confirmation error when all responses contain no session", async () => {
    vi.mocked(authClient.getSession).mockResolvedValue({ data: null } as never);
    const assertion = expect(waitForAuthenticatedUser()).rejects.toThrow(
      "Не удалось подтвердить сессию пользователя.",
    );
    await vi.runAllTimersAsync();
    await assertion;
    expect(authClient.getSession).toHaveBeenCalledTimes(8);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("retains the last network error when subsequent attempts return no session", async () => {
    const failure = new Error("Network failed");
    vi.mocked(authClient.getSession)
      .mockRejectedValueOnce(failure)
      .mockResolvedValue({ data: null } as never);
    const assertion = expect(waitForAuthenticatedUser()).rejects.toBe(failure);
    await vi.runAllTimersAsync();
    await assertion;
    expect(authClient.getSession).toHaveBeenCalledTimes(8);
  });
});
