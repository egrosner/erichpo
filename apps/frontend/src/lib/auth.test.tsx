import { render, screen, waitFor } from "@testing-library/react";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./auth";

// Expose auth values from inside the provider
function AuthConsumer() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(auth.isLoading)}</span>
      <span data-testid="authenticated">{String(auth.isAuthenticated)}</span>
      <span data-testid="hasWorkspaces">{String(auth.hasWorkspaces)}</span>
      <span data-testid="isWorkspaceAdmin">
        {String(auth.isWorkspaceAdmin)}
      </span>
      <span data-testid="username">{auth.user?.githubUsername ?? "none"}</span>
      <span data-testid="workspace">
        {auth.currentWorkspace?.teamName ?? "none"}
      </span>
    </div>
  );
}

const mockUser = {
  id: 1,
  githubId: 1001,
  githubUsername: "testuser",
  email: "test@example.com",
  avatarUrl: null,
  sessionId: "sess-1",
  workspaces: [
    { workspaceId: 10, teamId: "T1", teamName: "Acme", role: "admin" as const },
    { workspaceId: 20, teamId: "T2", teamName: "Beta", role: "user" as const },
  ],
  currentWorkspace: {
    workspaceId: 10,
    teamId: "T1",
    teamName: "Acme",
    role: "admin" as const,
  },
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("AuthProvider", () => {
  it("fetches the current user on mount", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockUser,
    } as Response);

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    // Initially loading
    expect(screen.getByTestId("loading").textContent).toBe("true");

    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false"),
    );

    expect(screen.getByTestId("authenticated").textContent).toBe("true");
    expect(screen.getByTestId("username").textContent).toBe("testuser");
    expect(screen.getByTestId("workspace").textContent).toBe("Acme");
    expect(screen.getByTestId("hasWorkspaces").textContent).toBe("true");
    expect(screen.getByTestId("isWorkspaceAdmin").textContent).toBe("true");
  });

  it("sets user to null when fetch returns non-ok", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
    } as Response);

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false"),
    );

    expect(screen.getByTestId("authenticated").textContent).toBe("false");
    expect(screen.getByTestId("hasWorkspaces").textContent).toBe("false");
  });

  it("sets user to null when fetch throws", async () => {
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("Network error"));

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false"),
    );

    expect(screen.getByTestId("authenticated").textContent).toBe("false");
  });

  it("computes isWorkspaceAdmin=false for user role", async () => {
    const userRoleUser = {
      ...mockUser,
      currentWorkspace: {
        workspaceId: 20,
        teamId: "T2",
        teamName: "Beta",
        role: "user" as const,
      },
    };

    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => userRoleUser,
    } as Response);

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false"),
    );

    expect(screen.getByTestId("isWorkspaceAdmin").textContent).toBe("false");
  });

  it("computes hasWorkspaces=false when workspaces is empty", async () => {
    const noWorkspacesUser = {
      ...mockUser,
      workspaces: [],
      currentWorkspace: null,
    };

    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => noWorkspacesUser,
    } as Response);

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false"),
    );

    expect(screen.getByTestId("hasWorkspaces").textContent).toBe("false");
    expect(screen.getByTestId("isWorkspaceAdmin").textContent).toBe("false");
  });
});

describe("useAuth", () => {
  it("throws when used outside AuthProvider", () => {
    // Suppress React error boundary noise
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<AuthConsumer />)).toThrow(
      "useAuth must be used within AuthProvider",
    );

    spy.mockRestore();
  });
});

describe("switchWorkspace", () => {
  it("updates user on successful switch", async () => {
    const switchedUser = {
      ...mockUser,
      currentWorkspace: {
        workspaceId: 20,
        teamId: "T2",
        teamName: "Beta",
        role: "user" as const,
      },
    };

    const fetchMock = vi.spyOn(global, "fetch") as Mock;
    // First call: fetchUser on mount
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => mockUser,
    } as Response);
    // Second call: switchWorkspace
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => switchedUser,
    } as Response);

    function SwitchTester() {
      const { switchWorkspace, currentWorkspace } = useAuth();
      return (
        <div>
          <span data-testid="workspace">
            {currentWorkspace?.teamName ?? "none"}
          </span>
          <button type="button" onClick={() => switchWorkspace(20)}>
            Switch
          </button>
        </div>
      );
    }

    render(
      <AuthProvider>
        <SwitchTester />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("workspace").textContent).toBe("Acme"),
    );

    screen.getByRole("button", { name: "Switch" }).click();

    await waitFor(() =>
      expect(screen.getByTestId("workspace").textContent).toBe("Beta"),
    );
  });

  it("throws on failed switch", async () => {
    const fetchMock = vi.spyOn(global, "fetch") as Mock;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => mockUser,
    } as Response);
    fetchMock.mockResolvedValueOnce({ ok: false } as Response);

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    let caughtError: Error | null = null;

    function SwitchTester() {
      const { switchWorkspace } = useAuth();
      return (
        <button
          type="button"
          onClick={async () => {
            try {
              await switchWorkspace(999);
            } catch (e) {
              caughtError = e as Error;
            }
          }}
        >
          Switch
        </button>
      );
    }

    render(
      <AuthProvider>
        <SwitchTester />
      </AuthProvider>,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

    screen.getByRole("button", { name: "Switch" }).click();

    await waitFor(() => expect(caughtError).toBeTruthy());
    expect(caughtError?.message).toBe("Failed to switch workspace");

    errorSpy.mockRestore();
  });
});
