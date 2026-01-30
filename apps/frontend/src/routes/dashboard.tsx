import { createRoute, Link, useSearch } from "@tanstack/react-router";
import { Route as rootRoute } from "./__root";
import { ProtectedRoute } from "@/components/protected-route";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { MembersManagement } from "@/components/members-management";
import { UserPreferences } from "@/components/user-preferences";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { GitBranch, LogOut, Building2, CheckCircle, AlertCircle, X } from "lucide-react";
import { useState, useEffect } from "react";

type DashboardSearch = {
  invited?: string;
  invite_error?: string;
};

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard",
  component: DashboardPage,
  validateSearch: (search: Record<string, unknown>): DashboardSearch => ({
    invited: typeof search.invited === "string" ? search.invited : undefined,
    invite_error:
      typeof search.invite_error === "string" ? search.invite_error : undefined,
  }),
});

function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}

function DashboardContent() {
  const { user, isWorkspaceAdmin, currentWorkspace, logout } = useAuth();
  const { invited, invite_error } = useSearch({ from: "/dashboard" });
  const [showInviteBanner, setShowInviteBanner] = useState(!!invited);
  const [showErrorBanner, setShowErrorBanner] = useState(!!invite_error);

  // Clear URL params after showing banner
  useEffect(() => {
    if (invited || invite_error) {
      const url = new URL(window.location.href);
      url.searchParams.delete("invited");
      url.searchParams.delete("invite_error");
      window.history.replaceState({}, "", url.pathname);
    }
  }, [invited, invite_error]);

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
            <WorkspaceSwitcher />
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
        {showInviteBanner && invited && (
          <Alert className="mb-6 border-green-500 bg-green-50 dark:bg-green-950">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <AlertTitle>Welcome!</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <span>You've successfully joined <strong>{invited}</strong>.</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setShowInviteBanner(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {showErrorBanner && invite_error && (
          <Alert className="mb-6" variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Invite Error</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <span>{invite_error}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setShowErrorBanner(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="mb-6">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          {currentWorkspace && (
            <p className="text-muted-foreground">
              {currentWorkspace.teamName}
              {isWorkspaceAdmin && " (Admin)"}
            </p>
          )}
        </div>

        <div className="grid gap-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Welcome, {user?.githubUsername}</CardTitle>
                <CardDescription>
                  {currentWorkspace
                    ? `Connected to ${currentWorkspace.teamName}`
                    : "No workspace selected"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  GitHub ID: {user?.githubId}
                </p>
                {user?.email && (
                  <p className="text-sm text-muted-foreground">
                    Email: {user.email}
                  </p>
                )}
                {currentWorkspace && (
                  <p className="text-sm text-muted-foreground">
                    Role: {currentWorkspace.role}
                  </p>
                )}
              </CardContent>
            </Card>

            {currentWorkspace && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    <CardTitle>Current Workspace</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="font-medium">{currentWorkspace.teamName}</p>
                  <p className="text-sm text-muted-foreground">
                    Team ID: {currentWorkspace.teamId}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Your role: {currentWorkspace.role === "admin" ? "Admin" : "User"}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {currentWorkspace && <UserPreferences />}

          {isWorkspaceAdmin && <MembersManagement />}
        </div>
      </main>
    </div>
  );
}
