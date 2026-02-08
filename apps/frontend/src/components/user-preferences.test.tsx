import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

const mockUseAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

import { UserPreferences } from "./user-preferences";

beforeEach(() => {
  vi.restoreAllMocks();
  mockUseAuth.mockReturnValue({
    currentWorkspace: {
      workspaceId: 10,
      teamId: "T1",
      teamName: "Acme Corp",
      role: "admin",
    },
  });
});

const mockPreferences = {
  slackMentions: true,
  slackInvites: false,
  slackConnected: false,
  slackUserId: null,
};

describe("UserPreferences", () => {
  it("returns null when there is no current workspace", () => {
    mockUseAuth.mockReturnValue({ currentWorkspace: null });

    const { container } = render(<UserPreferences />);
    expect(container.innerHTML).toBe("");
  });

  it("shows loading state while fetching preferences", () => {
    vi.spyOn(global, "fetch").mockReturnValue(new Promise(() => {}));

    render(<UserPreferences />);
    expect(screen.getByText("Loading preferences...")).toBeInTheDocument();
  });

  it("renders preferences after successful fetch", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockPreferences,
    } as Response);

    render(<UserPreferences />);

    await waitFor(() =>
      expect(screen.getByText("Slack Mentions")).toBeInTheDocument(),
    );
    expect(screen.getByText("Channel Invites")).toBeInTheDocument();
    expect(screen.getByText("Not Connected")).toBeInTheDocument();
  });

  it("shows Connected badge when Slack is connected", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...mockPreferences, slackConnected: true }),
    } as Response);

    render(<UserPreferences />);

    await waitFor(() =>
      expect(screen.getByText("Connected")).toBeInTheDocument(),
    );
    expect(screen.getByText("Disconnect")).toBeInTheDocument();
  });

  it("shows error when fetch fails", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
    } as Response);

    render(<UserPreferences />);

    await waitFor(() =>
      expect(
        screen.getByText("Failed to load preferences"),
      ).toBeInTheDocument(),
    );
  });

  it("optimistically updates and reverts on failure when toggling a preference", async () => {
    const fetchMock = vi.spyOn(global, "fetch") as Mock;
    // Initial load
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...mockPreferences, slackMentions: true }),
    } as Response);

    render(<UserPreferences />);

    await waitFor(() =>
      expect(screen.getByText("Slack Mentions")).toBeInTheDocument(),
    );

    // PATCH fails
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: "Server error" }),
    } as Response);

    // Find the first switch (Slack Mentions)
    const switches = screen.getAllByRole("switch");
    await userEvent.click(switches[0]);

    // Should show error and revert
    await waitFor(() =>
      expect(screen.getByText("Server error")).toBeInTheDocument(),
    );
  });

  it("disconnects Slack account on button click", async () => {
    const fetchMock = vi.spyOn(global, "fetch") as Mock;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...mockPreferences,
        slackConnected: true,
        slackUserId: "U123",
      }),
    } as Response);

    render(<UserPreferences />);

    await waitFor(() =>
      expect(screen.getByText("Disconnect")).toBeInTheDocument(),
    );

    // Mock the disconnect call
    fetchMock.mockResolvedValueOnce({ ok: true } as Response);

    await userEvent.click(screen.getByText("Disconnect"));

    await waitFor(() =>
      expect(
        screen.getByText("Slack account disconnected"),
      ).toBeInTheDocument(),
    );
  });
});
