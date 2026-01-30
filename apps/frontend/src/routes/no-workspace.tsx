import { createRoute, Link } from "@tanstack/react-router";
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
import { GitBranch, LogOut, Building2 } from "lucide-react";
import { Navigate } from "@tanstack/react-router";

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/no-workspace",
  component: NoWorkspacePage,
});

function NoWorkspacePage() {
  const { user, isAuthenticated, hasWorkspaces, isLoading, logout } = useAuth();

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
                To get started with erichpo, you need to be a member of a Slack workspace.
                There are two ways to join:
              </p>

              <div className="space-y-3">
                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium mb-1">Install the Slack App</h3>
                  <p className="text-sm text-muted-foreground">
                    If you have a GitHub installation ID, you can install the Slack app
                    to connect a workspace. You'll be automatically added as an admin.
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium mb-1">Get Invited by an Admin</h3>
                  <p className="text-sm text-muted-foreground">
                    Ask a workspace admin to invite you using your GitHub username:{" "}
                    <code className="bg-muted px-1 rounded">{user?.githubUsername}</code>
                  </p>
                </div>
              </div>

              <div className="flex justify-center pt-4">
                <Button variant="outline" onClick={() => window.location.reload()}>
                  Refresh
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
