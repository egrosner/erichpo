import type { CurrentUser, WorkspaceMembership } from "@erichpo/shared";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

interface AuthContextType {
  user: CurrentUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  workspaces: WorkspaceMembership[];
  currentWorkspace: WorkspaceMembership | null;
  isWorkspaceAdmin: boolean;
  hasWorkspaces: boolean;
  login: () => void;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
  switchWorkspace: (workspaceId: number) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        setUser(await res.json());
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = () => {
    window.location.href = "/api/auth/github";
  };

  const loginWithPassword = async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Login failed");
    }

    await fetchUser();
  };

  const register = async (email: string, password: string) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Registration failed");
    }

    await fetchUser();
  };

  const logout = async () => {
    window.location.href = "/api/auth/logout";
  };

  const switchWorkspace = async (workspaceId: number) => {
    try {
      const res = await fetch("/api/auth/switch-workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ workspaceId }),
      });

      if (res.ok) {
        const updatedUser = await res.json();
        setUser(updatedUser);
      } else {
        throw new Error("Failed to switch workspace");
      }
    } catch (error) {
      console.error("Switch workspace error:", error);
      throw error;
    }
  };

  const workspaces = user?.workspaces ?? [];
  const currentWorkspace = user?.currentWorkspace ?? null;
  const isWorkspaceAdmin = currentWorkspace?.role === "admin";
  const hasWorkspaces = workspaces.length > 0;

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        workspaces,
        currentWorkspace,
        isWorkspaceAdmin,
        hasWorkspaces,
        login,
        loginWithPassword,
        register,
        logout,
        refetch: fetchUser,
        switchWorkspace,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
