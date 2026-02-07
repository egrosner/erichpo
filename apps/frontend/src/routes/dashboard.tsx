import { MembersManagement } from "@/components/members-management";
import { OrgMappingsManagement } from "@/components/org-mappings-management";
import { ProtectedRoute } from "@/components/protected-route";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { UserPreferences } from "@/components/user-preferences";
import { WorkspaceSetupWizard } from "@/components/workspace-setup-wizard";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { useAuth } from "@/lib/auth";
import { Link, createRoute, useSearch } from "@tanstack/react-router";
import {
  AlertCircle,
  Building2,
  CheckCircle,
  GitBranch,
  LogOut,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Route as rootRoute } from "./__root";

type DashboardSearch = {
  invited?: string;
  invite_error?: string;
  workspace_setup?: "success" | "error";
  workspace_name?: string;
  workspace_id?: string;
  error?: string;
  // GitHub setup params
  github_linked?: "success";
  github_setup_error?: string;
  github_setup?: string; // installation_id for pre-selecting in wizard
};

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard",
  component: DashboardPage,
  validateSearch: (search: Record<string, unknown>): DashboardSearch => ({
    invited: typeof search.invited === "string" ? search.invited : undefined,
    invite_error:
      typeof search.invite_error === "string" ? search.invite_error : undefined,
    workspace_setup: search.workspace_setup as "success" | "error" | undefined,
    workspace_name: search.workspace_name as string | undefined,
    workspace_id: search.workspace_id as string | undefined,
    error: search.error as string | undefined,
    github_linked: search.github_linked as "success" | undefined,
    github_setup_error: search.github_setup_error as string | undefined,
    github_setup: search.github_setup as string | undefined,
  }),
});

function DashboardPage() {
  return (
    <ProtectedRoute requireWorkspace>
      <DashboardContent />
    </ProtectedRoute>
  );
}

function DashboardContent() {
  const { user, isWorkspaceAdmin, currentWorkspace, logout, refetch } =
    useAuth();
  const {
    invited,
    invite_error,
    workspace_setup,
    workspace_name,
    error,
    github_linked,
    github_setup_error,
  } = useSearch({ from: "/dashboard" });
  const [showInviteBanner, setShowInviteBanner] = useState(!!invited);
  const [showErrorBanner, setShowErrorBanner] = useState(!!invite_error);
  const [showGitHubLinkedBanner, setShowGitHubLinkedBanner] = useState(
    github_linked === "success",
  );
  const [showGitHubErrorBanner, setShowGitHubErrorBanner] = useState(
    !!github_setup_error,
  );
  const [wizardOpen, setWizardOpen] = useState(false);

  // Parse OAuth result from URL params
  const oauthResult = useMemo(() => {
    if (workspace_setup === "success") {
      return { success: true, workspaceName: workspace_name };
    }
    if (workspace_setup === "error") {
      return { success: false, error: error ?? "An unknown error occurred" };
    }
    return null;
  }, [workspace_setup, workspace_name, error]);

  // Auto-open wizard if returning from OAuth
  useEffect(() => {
    if (oauthResult) {
      setWizardOpen(true);
    }
  }, [oauthResult]);

  // Refetch on github_linked success to update org mappings list
  useEffect(() => {
    if (github_linked === "success") {
      refetch();
    }
  }, [github_linked, refetch]);

  // Handle wizard close - refetch auth and clear URL params
  const handleWizardClose = async (open: boolean) => {
    setWizardOpen(open);
    if (!open && oauthResult?.success) {
      await refetch();
    }
  };

  // Clear URL params after showing banner
  useEffect(() => {
    if (
      invited ||
      invite_error ||
      workspace_setup ||
      github_linked ||
      github_setup_error
    ) {
      const url = new URL(window.location.href);
      url.searchParams.delete("invited");
      url.searchParams.delete("invite_error");
      url.searchParams.delete("workspace_setup");
      url.searchParams.delete("workspace_name");
      url.searchParams.delete("workspace_id");
      url.searchParams.delete("error");
      url.searchParams.delete("github_linked");
      url.searchParams.delete("github_setup_error");
      url.searchParams.delete("github_setup");
      window.history.replaceState({}, "", url.pathname);
    }
  }, [
    invited,
    invite_error,
    workspace_setup,
    github_linked,
    github_setup_error,
  ]);

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
              <span>
                You've successfully joined <strong>{invited}</strong>.
              </span>
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

        {showGitHubLinkedBanner && (
          <Alert className="mb-6 border-green-500 bg-green-50 dark:bg-green-950">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <AlertTitle>GitHub Organization Linked</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <span>
                The GitHub organization has been linked to your workspace.
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setShowGitHubLinkedBanner(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {showGitHubErrorBanner && github_setup_error && (
          <Alert className="mb-6" variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>GitHub Setup Error</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <span>{github_setup_error}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setShowGitHubErrorBanner(false)}
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
                    Your role:{" "}
                    {currentWorkspace.role === "admin" ? "Admin" : "User"}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {currentWorkspace && <UserPreferences />}

          {isWorkspaceAdmin && <OrgMappingsManagement />}

          {isWorkspaceAdmin && <MembersManagement />}

          {isWorkspaceAdmin && currentWorkspace && (
            <DangerZone
              workspaceName={currentWorkspace.teamName}
              onDeleted={refetch}
            />
          )}
        </div>
      </main>

      <WorkspaceSetupWizard
        open={wizardOpen}
        onOpenChange={handleWizardClose}
        oauthResult={oauthResult}
      />
    </div>
  );
}

function DangerZone({
  workspaceName,
  onDeleted,
}: {
  workspaceName: string;
  onDeleted: () => Promise<void>;
}) {
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/workspace", {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to delete workspace");
      }
      await onDeleted();
    } catch (err) {
      setError((err as Error).message);
      setDeleting(false);
    }
  };

  return (
    <Card className="border-destructive">
      <CardHeader>
        <CardTitle className="text-destructive">Danger Zone</CardTitle>
        <CardDescription>
          Irreversible actions that permanently affect this workspace.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Delete this workspace</p>
            <p className="text-sm text-muted-foreground">
              Permanently delete <strong>{workspaceName}</strong> and all its
              data including org mappings, user mappings, PR channels, and
              members.
            </p>
          </div>
          <AlertDialog
            open={open}
            onOpenChange={(o) => {
              setOpen(o);
              if (!o) {
                setConfirmText("");
                setError(null);
              }
            }}
          >
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Workspace
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete workspace?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete <strong>{workspaceName}</strong>{" "}
                  and all associated data. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="grid gap-2">
                <label
                  htmlFor="confirm-delete"
                  className="text-sm text-muted-foreground"
                >
                  Type <strong>{workspaceName}</strong> to confirm:
                </label>
                <Input
                  id="confirm-delete"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={workspaceName}
                  autoComplete="off"
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={confirmText !== workspaceName || deleting}
                  onClick={handleDelete}
                >
                  {deleting ? "Deleting..." : "Delete Workspace"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
