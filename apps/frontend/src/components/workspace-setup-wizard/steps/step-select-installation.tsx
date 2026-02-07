import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getGitHubInstallUrlForLink,
  getGitHubInstallUrlForNewWorkspace,
} from "@/lib/github";
import { Building2, ExternalLink, Github, RefreshCw, User } from "lucide-react";
import { useEffect, useState } from "react";

export interface Installation {
  id: number;
  account: {
    login: string;
    avatarUrl: string;
    type: "User" | "Organization";
  };
  isLinked: boolean;
}

interface StepSelectInstallationProps {
  selectedId: number | null;
  onSelect: (id: number, name: string) => void;
  onNext: () => void;
  filterLinked?: boolean;
  showNextButton?: boolean;
  /** For "link" intent - the workspace to link to */
  linkToWorkspaceId?: number;
}

export function StepSelectInstallation({
  selectedId,
  onSelect,
  onNext,
  filterLinked = true,
  showNextButton = true,
  linkToWorkspaceId,
}: StepSelectInstallationProps) {
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInstallations = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/github/installations", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch installations");
      const data = await res.json();
      setInstallations(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstallations();
  }, []);

  // Generate the appropriate install URL based on intent
  const githubInstallUrl = linkToWorkspaceId
    ? getGitHubInstallUrlForLink(linkToWorkspaceId)
    : getGitHubInstallUrlForNewWorkspace();

  const availableInstallations = filterLinked
    ? installations.filter((i) => !i.isLinked)
    : installations;

  const handleSelect = (value: string) => {
    const inst = installations.find((i) => i.id === Number(value));
    if (inst) {
      onSelect(inst.id, inst.account.login);
    }
  };

  // Show install step when no installations at all
  if (!loading && !error && installations.length === 0) {
    return (
      <div className="space-y-4">
        <div className="text-center py-6 space-y-4">
          <div className="flex justify-center">
            <div className="p-3 rounded-full bg-muted">
              <Github className="h-8 w-8 text-muted-foreground" />
            </div>
          </div>

          <div>
            <h3 className="font-medium mb-1">Install the GitHub App</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              First, install the erichpo GitHub App on your organization or
              personal account. This allows us to receive PR events and post
              comments.
            </p>
          </div>

          <div className="flex flex-col items-center gap-2">
            {githubInstallUrl ? (
              <Button asChild>
                <a href={githubInstallUrl}>
                  <Github className="h-4 w-4 mr-2" />
                  Install GitHub App
                </a>
              </Button>
            ) : (
              <p className="text-sm text-destructive">
                GitHub App URL not configured
              </p>
            )}

            <Button variant="ghost" size="sm" onClick={fetchInstallations}>
              <RefreshCw className="h-4 w-4 mr-2" />
              I've installed it, refresh
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Show message when all installations are already linked
  if (!loading && !error && availableInstallations.length === 0) {
    return (
      <div className="space-y-4">
        <div className="text-center py-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            All your GitHub installations are already linked to workspaces.
          </p>
          <div className="flex flex-col items-center gap-2">
            {githubInstallUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={githubInstallUrl}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Install on another org
                </a>
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={fetchInstallations}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Select a GitHub organization or user account to connect.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="text-center py-4">
          <p className="text-sm text-destructive mb-2">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchInstallations}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      ) : (
        <>
          <Select
            value={selectedId?.toString() ?? ""}
            onValueChange={handleSelect}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select an installation" />
            </SelectTrigger>
            <SelectContent>
              {availableInstallations.map((inst) => (
                <SelectItem key={inst.id} value={inst.id.toString()}>
                  <div className="flex items-center gap-2">
                    {inst.account.type === "Organization" ? (
                      <Building2 className="h-4 w-4" />
                    ) : (
                      <User className="h-4 w-4" />
                    )}
                    <img
                      src={inst.account.avatarUrl}
                      alt=""
                      className="h-5 w-5 rounded-full"
                    />
                    <span>{inst.account.login}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {githubInstallUrl && (
              <a
                href={githubInstallUrl}
                className="hover:underline inline-flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                Install on another org
              </a>
            )}
            <span className="text-muted-foreground/50">|</span>
            <button
              type="button"
              onClick={fetchInstallations}
              className="hover:underline inline-flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </button>
          </div>
        </>
      )}

      {showNextButton && (
        <div className="flex justify-end pt-2">
          <Button onClick={onNext} disabled={!selectedId}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
