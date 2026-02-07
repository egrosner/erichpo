import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

const mockUseAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock LinkGitHubWizard to avoid rendering the full wizard
vi.mock("@/components/link-github-wizard", () => ({
  LinkGitHubWizard: ({ open }: { open: boolean }) =>
    open ? <div data-testid="link-wizard">Wizard</div> : null,
}));

import { OrgMappingsManagement } from "./org-mappings-management";

beforeEach(() => {
  vi.restoreAllMocks();
  mockUseAuth.mockReturnValue({ isWorkspaceAdmin: true });
});

const mockMappings = [
  {
    id: 1,
    githubInstallationId: 101,
    slackWorkspaceId: 10,
    createdAt: "2025-01-15T10:00:00Z",
    slackWorkspace: { teamId: "T1", teamName: "Acme" },
  },
  {
    id: 2,
    githubInstallationId: 202,
    slackWorkspaceId: 10,
    createdAt: "2025-02-20T12:00:00Z",
    slackWorkspace: { teamId: "T1", teamName: "Acme" },
  },
];

describe("OrgMappingsManagement", () => {
  it("returns null for non-admin users", () => {
    mockUseAuth.mockReturnValue({ isWorkspaceAdmin: false });

    const { container } = render(<OrgMappingsManagement />);
    expect(container.innerHTML).toBe("");
  });

  it("shows loading spinner initially", () => {
    vi.spyOn(global, "fetch").mockReturnValue(new Promise(() => {}));

    render(<OrgMappingsManagement />);
    // The card should be present with the title
    expect(screen.getByText("Linked GitHub Organizations")).toBeInTheDocument();
  });

  it("renders mappings table after fetch", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockMappings,
    } as Response);

    render(<OrgMappingsManagement />);

    await waitFor(() => expect(screen.getByText("#101")).toBeInTheDocument());
    expect(screen.getByText("#202")).toBeInTheDocument();
  });

  it("shows empty state when no mappings exist", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response);

    render(<OrgMappingsManagement />);

    await waitFor(() =>
      expect(
        screen.getByText("No GitHub organizations linked yet"),
      ).toBeInTheDocument(),
    );
  });

  it("shows error state with retry button on fetch failure", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
    } as Response);

    render(<OrgMappingsManagement />);

    await waitFor(() =>
      expect(
        screen.getByText("Failed to fetch org mappings"),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });

  it("deletes a mapping after confirmation", async () => {
    const fetchMock = vi.spyOn(global, "fetch") as Mock;
    // Initial load
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => mockMappings,
    } as Response);

    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<OrgMappingsManagement />);

    await waitFor(() => expect(screen.getByText("#101")).toBeInTheDocument());

    // DELETE call + re-fetch
    fetchMock.mockResolvedValueOnce({ ok: true } as Response);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [mockMappings[1]],
    } as Response);

    // Click the first delete button
    const deleteButtons = screen.getAllByRole("button", { name: "" });
    // Find the button with a trash icon (the icon-only buttons in the table)
    const trashButtons = deleteButtons.filter(
      (btn) => btn.closest("td") !== null,
    );
    await userEvent.click(trashButtons[0]);

    await waitFor(() =>
      expect(screen.queryByText("#101")).not.toBeInTheDocument(),
    );
  });

  it("opens wizard when Link Organization button is clicked", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response);

    render(<OrgMappingsManagement />);

    await waitFor(() =>
      expect(
        screen.getByText("No GitHub organizations linked yet"),
      ).toBeInTheDocument(),
    );

    await userEvent.click(screen.getByText("Link your first organization"));

    expect(screen.getByTestId("link-wizard")).toBeInTheDocument();
  });
});
