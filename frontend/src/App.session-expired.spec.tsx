import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { DEFAULT_AUTH_ROUTE, LOGIN_ROUTE } from "./lib/hash-router";
import { emitSessionExpired } from "./shared/api/session-expired";
import { getAuthenticatedUser } from "./shared/api/auth-session";
import { getSetupStatus } from "./shared/api/setup";

vi.mock("./layouts/AppShell", () => ({
  AppShell: () => <div data-testid="app-shell">App shell</div>,
}));

vi.mock("./pages/LoginPage", () => ({
  LoginPage: () => <div data-testid="login-page">Login page</div>,
}));

vi.mock("./pages/SetupPage", () => ({
  SetupPage: () => <div data-testid="setup-page">Setup page</div>,
}));

vi.mock("./shared/api/setup", () => ({
  getSetupStatus: vi.fn(),
}));

vi.mock("./shared/api/auth-session", () => ({
  getAuthenticatedUser: vi.fn(),
  waitForAuthenticatedUser: vi.fn(),
}));

vi.mock("./lib/auth-client", () => ({
  authClient: {
    signOut: vi.fn(),
  },
}));

const sessionUser = {
  id: "user-1",
  username: "admin",
};

describe("App session-expired flow", () => {
  afterEach(() => {
    cleanup();
    window.location.hash = "";
    vi.clearAllMocks();
  });

  it("opens login normally on startup without an active session", async () => {
    window.location.hash = DEFAULT_AUTH_ROUTE;
    vi.mocked(getSetupStatus).mockResolvedValueOnce({ setupRequired: false });
    vi.mocked(getAuthenticatedUser).mockResolvedValueOnce(null);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("login-page")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("app-shell")).not.toBeInTheDocument();
    expect(window.location.hash).toBe(LOGIN_ROUTE);
  });

  it("resets authenticated UI and routes to login after session-expired", async () => {
    window.location.hash = DEFAULT_AUTH_ROUTE;
    vi.mocked(getSetupStatus).mockResolvedValueOnce({ setupRequired: false });
    vi.mocked(getAuthenticatedUser).mockResolvedValueOnce(sessionUser);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("app-shell")).toBeInTheDocument();
    });

    act(() => {
      emitSessionExpired();
    });

    await waitFor(() => {
      expect(screen.getByTestId("login-page")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("app-shell")).not.toBeInTheDocument();
    expect(window.location.hash).toBe(LOGIN_ROUTE);
  });

  it("stays stable on login after repeated session-expired events", async () => {
    window.location.hash = DEFAULT_AUTH_ROUTE;
    vi.mocked(getSetupStatus).mockResolvedValueOnce({ setupRequired: false });
    vi.mocked(getAuthenticatedUser).mockResolvedValueOnce(sessionUser);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("app-shell")).toBeInTheDocument();
    });

    act(() => {
      emitSessionExpired();
      emitSessionExpired();
      emitSessionExpired();
    });

    await waitFor(() => {
      expect(screen.getByTestId("login-page")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("app-shell")).not.toBeInTheDocument();
    expect(window.location.hash).toBe(LOGIN_ROUTE);
  });
});
