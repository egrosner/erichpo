import { LinkGitHubWizard } from "@/components/link-github-wizard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import { Github, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

interface OrgMapping {
  id: number;
  githubInstallationId: number;
  slackWorkspaceId: number;
  createdAt: string;
  slackWorkspace: {
    teamId: string;
    teamName: string;
  };
}

export function OrgMappingsManagement() {
  const { isWorkspaceAdmin } = useAuth();
  const [mappings, setMappings] = useState<OrgMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  const fetchMappings = async () => {
    try {
      const res = await fetch("/api/admin/org-mappings", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch org mappings");
      setMappings(await res.json());
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMappings();
  }, []);

  const handleDelete = async (installationId: number) => {
    if (!confirm("Are you sure you want to unlink this GitHub organization?")) {
      return;
    }

    setDeleting(installationId);
    try {
      const res = await fetch(`/api/admin/org-mappings/${installationId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to unlink organization");
      }
      await fetchMappings();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleting(null);
    }
  };

  const handleWizardClose = (open: boolean) => {
    setWizardOpen(open);
    if (!open) {
      // Refresh mappings when wizard closes
      fetchMappings();
    }
  };

  if (!isWorkspaceAdmin) {
    return null;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Github className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Linked GitHub Organizations</CardTitle>
                <CardDescription>
                  GitHub organizations connected to this workspace
                </CardDescription>
              </div>
            </div>
            <Button size="sm" onClick={() => setWizardOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Link Organization
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-4">
              <p className="text-sm text-destructive mb-2">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchMappings}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          ) : mappings.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <Github className="h-10 w-10 mx-auto text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                No GitHub organizations linked yet
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setWizardOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Link your first organization
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Installation ID</TableHead>
                  <TableHead>Linked</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.map((mapping) => (
                  <TableRow key={mapping.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Github className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono text-sm">
                          #{mapping.githubInstallationId}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {new Date(mapping.createdAt).toLocaleDateString()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          handleDelete(mapping.githubInstallationId)
                        }
                        disabled={deleting === mapping.githubInstallationId}
                      >
                        {deleting === mapping.githubInstallationId ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 text-destructive" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <LinkGitHubWizard open={wizardOpen} onOpenChange={handleWizardClose} />
    </>
  );
}
