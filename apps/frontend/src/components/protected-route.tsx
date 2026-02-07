import { useAuth } from "@/lib/auth";
import { Navigate } from "@tanstack/react-router";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireWorkspace?: boolean;
}

export function ProtectedRoute({
  children,
  requireWorkspace = false,
}: ProtectedRouteProps) {
  const { isAuthenticated, hasWorkspaces, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" />;
  }

  if (requireWorkspace && !hasWorkspaces) {
    return <Navigate to="/no-workspace" />;
  }

  return <>{children}</>;
}
