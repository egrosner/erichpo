import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock useAuth before importing the component
const mockUseAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock Navigate to capture redirect targets
const navigatedTo = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  Navigate: (props: { to: string }) => {
    navigatedTo(props.to);
    return <div data-testid="navigate">Redirecting to {props.to}</div>;
  },
}));

import { ProtectedRoute } from "./protected-route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProtectedRoute", () => {
  it("shows loading state when auth is loading", () => {
    mockUseAuth.mockReturnValue({
      isLoading: true,
      isAuthenticated: false,
      hasWorkspaces: false,
    });

    render(
      <ProtectedRoute>
        <div>Protected content</div>
      </ProtectedRoute>,
    );

    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("redirects to / when not authenticated", () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: false,
      hasWorkspaces: false,
    });

    render(
      <ProtectedRoute>
        <div>Protected content</div>
      </ProtectedRoute>,
    );

    expect(navigatedTo).toHaveBeenCalledWith("/");
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("renders children when authenticated (no workspace required)", () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      hasWorkspaces: false,
    });

    render(
      <ProtectedRoute>
        <div>Protected content</div>
      </ProtectedRoute>,
    );

    expect(screen.getByText("Protected content")).toBeInTheDocument();
  });

  it("redirects to /no-workspace when requireWorkspace=true and user has no workspaces", () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      hasWorkspaces: false,
    });

    render(
      <ProtectedRoute requireWorkspace>
        <div>Protected content</div>
      </ProtectedRoute>,
    );

    expect(navigatedTo).toHaveBeenCalledWith("/no-workspace");
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("renders children when requireWorkspace=true and user has workspaces", () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      hasWorkspaces: true,
    });

    render(
      <ProtectedRoute requireWorkspace>
        <div>Protected content</div>
      </ProtectedRoute>,
    );

    expect(screen.getByText("Protected content")).toBeInTheDocument();
  });
});
