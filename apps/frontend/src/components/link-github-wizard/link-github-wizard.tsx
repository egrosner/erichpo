import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StepSelectInstallation } from "@/components/workspace-setup-wizard/steps/step-select-installation";
import { useAuth } from "@/lib/auth";
import { Building2, CheckCircle2, Github, Link2 } from "lucide-react";
import { useState } from "react";

type WizardStep = "select" | "confirm" | "complete";

interface LinkGitHubWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LinkGitHubWizard({
  open,
  onOpenChange,
}: LinkGitHubWizardProps) {
  const { currentWorkspace, refetch } = useAuth();
  const [step, setStep] = useState<WizardStep>("select");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = (id: number, name: string) => {
    setSelectedId(id);
    setSelectedName(name);
    setError(null);
  };

  const handleLink = async () => {
    if (!selectedId) return;

    setLinking(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/org-mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ installationId: selectedId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to link organization");
      }

      setStep("complete");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLinking(false);
    }
  };

  const handleClose = async (isOpen: boolean) => {
    if (!isOpen) {
      // Reset state when closing
      setStep("select");
      setSelectedId(null);
      setSelectedName(null);
      setError(null);
      // Refetch auth to update any UI that shows org mappings
      await refetch();
    }
    onOpenChange(isOpen);
  };

  const stepContent = () => {
    switch (step) {
      case "select":
        return (
          <>
            <DialogHeader>
              <DialogTitle>Link GitHub Organization</DialogTitle>
              <DialogDescription>
                Link a GitHub organization to {currentWorkspace?.teamName}
              </DialogDescription>
            </DialogHeader>
            <StepSelectInstallation
              selectedId={selectedId}
              onSelect={handleSelect}
              onNext={() => setStep("confirm")}
              filterLinked={true}
              showNextButton={true}
              linkToWorkspaceId={currentWorkspace?.workspaceId}
            />
          </>
        );

      case "confirm":
        return (
          <>
            <DialogHeader>
              <DialogTitle>Confirm Link</DialogTitle>
              <DialogDescription>
                Review and confirm the organization link
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-3">
                <div className="flex items-center gap-3">
                  <Github className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{selectedName}</p>
                    <p className="text-sm text-muted-foreground">
                      GitHub Installation #{selectedId}
                    </p>
                  </div>
                </div>

                <div className="flex justify-center">
                  <Link2 className="h-4 w-4 text-muted-foreground" />
                </div>

                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{currentWorkspace?.teamName}</p>
                    <p className="text-sm text-muted-foreground">
                      Slack Workspace
                    </p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <p className="text-sm text-muted-foreground">
                PRs from repositories in <strong>{selectedName}</strong> will
                create channels in <strong>{currentWorkspace?.teamName}</strong>
                .
              </p>

              <div className="flex justify-between pt-2">
                <Button
                  variant="outline"
                  onClick={() => setStep("select")}
                  disabled={linking}
                >
                  Back
                </Button>
                <Button onClick={handleLink} disabled={linking}>
                  {linking ? "Linking..." : "Link Organization"}
                </Button>
              </div>
            </div>
          </>
        );

      case "complete":
        return (
          <>
            <DialogHeader>
              <DialogTitle>Organization Linked</DialogTitle>
              <DialogDescription>
                The organization has been linked successfully
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 text-center py-4">
              <div className="flex justify-center">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
              </div>

              <div>
                <h3 className="text-lg font-semibold">Success</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  <strong>{selectedName}</strong> is now linked to{" "}
                  <strong>{currentWorkspace?.teamName}</strong>.
                </p>
              </div>

              <p className="text-sm text-muted-foreground">
                PRs from this organization will now create Slack channels
                automatically.
              </p>

              <div className="pt-2">
                <Button onClick={() => handleClose(false)}>Done</Button>
              </div>
            </div>
          </>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">{stepContent()}</DialogContent>
    </Dialog>
  );
}
