import type { CurrentUser, WorkspaceMembership } from "@erichpo/shared";
import { type ReactNode, createContext, useContext } from "react";

/** Shape that matches useAuth() return type */
interface AuthContextType {
  user: CurrentUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  workspaces: WorkspaceMembership[];
  currentWorkspace: WorkspaceMembership | null;
  isWorkspaceAdmin: boolean;
  hasWorkspaces: boolean;
  login: () => void;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
  switchWorkspace: (workspaceId: number) => Promise<void>;
}

/**
 * Mock auth values for tests. Provide overrides for specific scenarios.
 */
export function createMockAuth(
  overrides: Partial<AuthContextType> = {},
): AuthContextType {
  return {
    user: null,
    isLoading: false,
    isAuthenticated: false,
    workspaces: [],
    currentWorkspace: null,
    isWorkspaceAdmin: false,
    hasWorkspaces: false,
    login: () => {},
    logout: async () => {},
    refetch: async () => {},
    switchWorkspace: async () => {},
    ...overrides,
  };
}

export const mockAdminUser: CurrentUser = {
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

export const mockRegularUser: CurrentUser = {
  id: 2,
  githubId: 1002,
  githubUsername: "regular-user",
  email: "user@example.com",
  avatarUrl: null,
  sessionId: "sess-2",
  workspaces: [
    { workspaceId: 10, teamId: "T1", teamName: "Acme Corp", role: "user" },
  ],
  currentWorkspace: {
    workspaceId: 10,
    teamId: "T1",
    teamName: "Acme Corp",
    role: "user",
  },
};

/**
 * Pre-built auth configs for common test scenarios
 */
export const authScenarios = {
  loading: createMockAuth({ isLoading: true }),

  unauthenticated: createMockAuth(),

  authenticatedAdmin: createMockAuth({
    user: mockAdminUser,
    isAuthenticated: true,
    workspaces: mockAdminUser.workspaces,
    currentWorkspace: mockAdminUser.currentWorkspace,
    isWorkspaceAdmin: true,
    hasWorkspaces: true,
  }),

  authenticatedUser: createMockAuth({
    user: mockRegularUser,
    isAuthenticated: true,
    workspaces: mockRegularUser.workspaces,
    currentWorkspace: mockRegularUser.currentWorkspace,
    isWorkspaceAdmin: false,
    hasWorkspaces: true,
  }),

  noWorkspaces: createMockAuth({
    user: {
      ...mockRegularUser,
      workspaces: [],
      currentWorkspace: null,
    },
    isAuthenticated: true,
    workspaces: [],
    currentWorkspace: null,
    isWorkspaceAdmin: false,
    hasWorkspaces: false,
  }),
};
