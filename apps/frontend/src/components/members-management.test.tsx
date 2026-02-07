import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

const mockUseAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

import { MembersManagement } from "./members-management";

const currentUser = {
  id: 1,
  githubId: 1001,
  githubUsername: "admin-user",
  email: "admin@example.com",
  avatarUrl: null,
  sessionId: "sess-1",
  workspaces: [
    { workspaceId: 10, teamId: "T1", teamName: "Acme Corp", role: "admin" },
  ],
  currentWorkspace: {
    workspaceId: 10,
    teamId: "T1",
    teamName: "Acme Corp",
    role: "admin",
  },
};

const mockMembers = [
  {
    userId: 1,
    githubId: 1001,
    githubUsername: "admin-user",
    email: "admin@example.com",
    avatarUrl: null,
    role: "admin" as const,
    joinedAt: "2025-01-01T00:00:00Z",
  },
  {
    userId: 2,
    githubId: 1002,
    githubUsername: "dev-user",
    email: "dev@example.com",
    avatarUrl: null,
    role: "user" as const,
    joinedAt: "2025-02-01T00:00:00Z",
  },
];

const mockSlackUsers = [
  { id: "U1", name: "adminslack", real_name: "Admin Person" },
  { id: "U2", name: "devslack", real_name: "Dev Person" },
];

beforeEach(() => {
  vi.restoreAllMocks();
  mockUseAuth.mockReturnValue({
    currentWorkspace: currentUser.currentWorkspace,
    user: currentUser,
  });
});

/** Helper: mock all three initial fetch calls (members, slack-users, user-mappings) */
function mockInitialFetches(
  members = mockMembers,
  slackUsers = mockSlackUsers,
  mappings: unknown[] = [],
) {
  const fetchMock = vi.spyOn(global, "fetch") as Mock;
  fetchMock.mockImplementation((url: string) => {
    if (url.includes("/api/admin/members")) {
      return Promise.resolve({
        ok: true,
        json: async () => members,
      });
    }
    if (url.includes("/api/admin/slack-users")) {
      return Promise.resolve({
        ok: true,
        json: async () => slackUsers,
      });
    }
    if (url.includes("/api/admin/user-mappings")) {
      return Promise.resolve({
        ok: true,
        json: async () => mappings,
      });
    }
    return Promise.resolve({ ok: false });
  });
  return fetchMock;
}

describe("MembersManagement", () => {
  it("returns null when there is no current workspace", () => {
    mockUseAuth.mockReturnValue({ currentWorkspace: null, user: null });

    const { container } = render(<MembersManagement />);
    expect(container.innerHTML).toBe("");
  });

  it("shows loading state then renders members", async () => {
    mockInitialFetches();

    render(<MembersManagement />);

    expect(screen.getByText("Loading members...")).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByText("admin-user")).toBeInTheDocument(),
    );
    expect(screen.getByText("dev-user")).toBeInTheDocument();
  });

  it("shows 'You' badge next to the current user", async () => {
    mockInitialFetches();

    render(<MembersManagement />);

    await waitFor(() => expect(screen.getByText("You")).toBeInTheDocument());
  });

  it("invites a user via the invite form", async () => {
    const fetchMock = mockInitialFetches();

    render(<MembersManagement />);

    await waitFor(() =>
      expect(screen.getByText("admin-user")).toBeInTheDocument(),
    );

    const input = screen.getByPlaceholderText("GitHub username");
    await userEvent.type(input, "new-user");

    // Mock the invite POST + refetch
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (
        url.includes("/api/admin/members/invite") &&
        init?.method === "POST"
      ) {
        return Promise.resolve({ ok: true } as Response);
      }
      if (url.includes("/api/admin/members")) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            ...mockMembers,
            {
              userId: 3,
              githubId: 1003,
              githubUsername: "new-user",
              email: null,
              avatarUrl: null,
              role: "user",
              joinedAt: "2025-03-01T00:00:00Z",
            },
          ],
        });
      }
      if (url.includes("/api/admin/slack-users")) {
        return Promise.resolve({
          ok: true,
          json: async () => mockSlackUsers,
        });
      }
      if (url.includes("/api/admin/user-mappings")) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      return Promise.resolve({ ok: false });
    });

    await userEvent.click(screen.getByText("Invite"));

    await waitFor(() =>
      expect(screen.getByText("new-user")).toBeInTheDocument(),
    );
  });

  it("shows error when invite fails", async () => {
    const fetchMock = mockInitialFetches();

    render(<MembersManagement />);

    await waitFor(() =>
      expect(screen.getByText("admin-user")).toBeInTheDocument(),
    );

    const input = screen.getByPlaceholderText("GitHub username");
    await userEvent.type(input, "bad-user");

    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/api/admin/members/invite")) {
        return Promise.resolve({
          ok: false,
          json: async () => ({ message: "User not found on GitHub" }),
        } as Response);
      }
      // Return defaults for other calls
      if (url.includes("/api/admin/members")) {
        return Promise.resolve({
          ok: true,
          json: async () => mockMembers,
        });
      }
      if (url.includes("/api/admin/slack-users")) {
        return Promise.resolve({
          ok: true,
          json: async () => mockSlackUsers,
        });
      }
      if (url.includes("/api/admin/user-mappings")) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      return Promise.resolve({ ok: false });
    });

    await userEvent.click(screen.getByText("Invite"));

    await waitFor(() =>
      expect(screen.getByText("User not found on GitHub")).toBeInTheDocument(),
    );
  });

  it("does not show remove button for the current user", async () => {
    mockInitialFetches([mockMembers[0]]); // Only the current user

    render(<MembersManagement />);

    await waitFor(() =>
      expect(screen.getByText("admin-user")).toBeInTheDocument(),
    );

    // No trash/remove button should exist in the actions column
    const actionCells = document.querySelectorAll(
      "table tbody tr td:last-child",
    );
    // The current user's row should not have a button
    expect(actionCells[0]?.querySelector("button")).toBeNull();
  });

  it("generates an invite link", async () => {
    const fetchMock = mockInitialFetches();

    // Mock clipboard
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });

    render(<MembersManagement />);

    await waitFor(() =>
      expect(screen.getByText("admin-user")).toBeInTheDocument(),
    );

    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/api/admin/invite-links") && init?.method === "POST") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ token: "abc123" }),
        } as Response);
      }
      return Promise.resolve({ ok: false });
    });

    await userEvent.click(screen.getByText("Generate Invite Link"));

    await waitFor(() =>
      expect(screen.getByDisplayValue(/abc123/)).toBeInTheDocument(),
    );
  });
});
