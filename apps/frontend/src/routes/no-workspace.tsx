import { useEffect, useMemo, useState } from "react";
import { createRoute, Link, useSearch } from "@tanstack/react-router";
import { Route as rootRoute } from "./__root";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GitBranch, LogOut, Building2, Plus } from "lucide-react";
import { Navigate, useNavigate } from "@tanstack/react-router";
import { WorkspaceSetupWizard } from "@/components/workspace-setup-wizard";

interface NoWorkspaceSearch {
  workspace_setup?: "success" | "error";
  workspace_name?: string;
  workspace_id?: string;
  error?: string;
  github_setup?: string; // installation_id from GitHub App setup callback
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/no-workspace",
  component: NoWorkspacePage,
  validateSearch: (search: Record<string, unknown>): NoWorkspaceSearch => ({
    workspace_setup: search.workspace_setup as
      | "success"
      | "error"
      | undefined,
    workspace_name: search.workspace_name as string | undefined,
    workspace_id: search.workspace_id as string | undefined,
    error: search.error as string | undefined,
    github_setup: search.github_setup as string | undefined,
  }),
});

function NoWorkspacePage() {
  const { user, isAuthenticated, hasWorkspaces, isLoading, logout } = useAuth();
  const search = useSearch({ from: Route.fullPath });
  const navigate = useNavigate();
  const [wizardOpen, setWizardOpen] = useState(false);

  // Parse OAuth result from URL params
  const oauthResult = useMemo(() => {
    if (search.workspace_setup === "success") {
      return {
        success: true,
        workspaceName: search.workspace_name,
      };
    }
    if (search.workspace_setup === "error") {
      return {
        success: false,
        error: search.error ?? "An unknown error occurred",
      };
    }
    return null;
  }, [search]);

  // Pre-selected installation from GitHub App callback
  const preSelectedInstallationId = search.github_setup
    ? Number(search.github_setup)
    : undefined;

  // Auto-open wizard if returning from OAuth or GitHub setup
  useEffect(() => {
    if (oauthResult || preSelectedInstallationId) {
      setWizardOpen(true);
      // Clear URL params after opening wizard
      navigate({ to: "/no-workspace", search: {}, replace: true });
    }
  }, [oauthResult, preSelectedInstallationId, navigate]);

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

  // If user now has workspaces, redirect to dashboard
  if (hasWorkspaces) {
    return <Navigate to="/dashboard" />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link to="/" className="flex items-center gap-2">
              <GitBranch className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold">erichpo</span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {user?.githubUsername}
            </span>
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <Building2 className="h-12 w-12 text-muted-foreground" />
              </div>
              <CardTitle>No Workspaces Available</CardTitle>
              <CardDescription>
                You don't have access to any Slack workspaces yet
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                To get started with erichpo, you need to be a member of a Slack
                workspace. There are two ways to join:
              </p>

              <div className="space-y-3">
                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium mb-1">Set Up a New Workspace</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Connect a GitHub organization to a Slack workspace. You'll be
                    automatically added as an admin.
                  </p>
                  <Button onClick={() => setWizardOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Set Up New Workspace
                  </Button>
                </div>

                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium mb-1">Get Invited by an Admin</h3>
                  <p className="text-sm text-muted-foreground">
                    Ask a workspace admin to invite you using your GitHub
                    username:{" "}
                    <code className="bg-muted px-1 rounded">
                      {user?.githubUsername}
                    </code>
                  </p>
                </div>
              </div>

              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  onClick={() => window.location.reload()}
                >
                  Refresh
                </Button>
              </div>

              <WorkspaceSetupWizard
                open={wizardOpen}
                onOpenChange={setWizardOpen}
                oauthResult={oauthResult}
                preSelectedInstallationId={preSelectedInstallationId}
              />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
