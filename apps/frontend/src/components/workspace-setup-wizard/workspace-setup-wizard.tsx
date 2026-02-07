import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { StepComplete } from "./steps/step-complete";
import { StepConnectSlack } from "./steps/step-connect-slack";
import { StepSelectInstallation } from "./steps/step-select-installation";
import {
  type WizardStep,
  useWizardPersistence,
} from "./use-wizard-persistence";

interface WorkspaceSetupWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialStep?: WizardStep;
  oauthResult?: {
    success: boolean;
    workspaceName?: string;
    error?: string;
  } | null;
  /** Pre-select an installation (from GitHub App setup callback) */
  preSelectedInstallationId?: number;
}

const stepTitles: Record<WizardStep, { title: string; description: string }> = {
  "select-installation": {
    title: "Select GitHub Installation",
    description: "Choose which GitHub organization or account to connect",
  },
  "connect-slack": {
    title: "Connect Slack",
    description: "Link your Slack workspace to enable sync",
  },
  complete: {
    title: "Setup Complete",
    description: "Your workspace is ready to use",
  },
};

export function WorkspaceSetupWizard({
  open,
  onOpenChange,
  initialStep,
  oauthResult,
  preSelectedInstallationId,
}: WorkspaceSetupWizardProps) {
  const { refetch } = useAuth();
  const wizard = useWizardPersistence();
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [completedWorkspaceName, setCompletedWorkspaceName] = useState<
    string | null
  >(null);
  const [preSelectHandled, setPreSelectHandled] = useState(false);

  // Handle initial step from props (e.g., from URL params)
  useEffect(() => {
    if (initialStep && wizard.isLoaded) {
      wizard.setStep(initialStep);
    }
  }, [initialStep, wizard.isLoaded]);

  // Handle pre-selected installation from GitHub App callback
  useEffect(() => {
    if (
      preSelectedInstallationId &&
      wizard.isLoaded &&
      open &&
      !preSelectHandled
    ) {
      // We have a pre-selected installation, set it and move to connect-slack
      // We don't know the name yet, but we can fetch it or use a placeholder
      wizard.setInstallation(
        preSelectedInstallationId,
        `Installation #${preSelectedInstallationId}`,
      );
      wizard.setStep("connect-slack");
      setPreSelectHandled(true);
    }
  }, [preSelectedInstallationId, wizard.isLoaded, open, preSelectHandled]);

  // Handle OAuth result
  useEffect(() => {
    if (oauthResult) {
      if (oauthResult.success && oauthResult.workspaceName) {
        setCompletedWorkspaceName(oauthResult.workspaceName);
        wizard.setStep("complete");
        wizard.setPendingOAuth(false);
      } else if (!oauthResult.success && oauthResult.error) {
        setOauthError(oauthResult.error);
        wizard.setStep("connect-slack");
        wizard.setPendingOAuth(false);
      }
    }
  }, [oauthResult]);

  const handleSelectInstallation = (id: number, name: string) => {
    wizard.setInstallation(id, name);
    setOauthError(null);
  };

  const handleConnectSlack = () => {
    if (!wizard.installationId) return;

    wizard.setPendingOAuth(true);

    // Build the OAuth URL with frontend redirect
    // Use current page path so OAuth returns to the right place
    const currentPath = window.location.pathname;
    const frontendRedirect = `${window.location.origin}${currentPath === "/" ? "/dashboard" : currentPath}`;
    const params = new URLSearchParams({
      installation_id: wizard.installationId.toString(),
      frontend_redirect: frontendRedirect,
    });

    // Redirect to backend OAuth initiation
    window.location.href = `/api/oauth/slack/install?${params.toString()}`;
  };

  const handleFinish = async () => {
    wizard.clearStorage();
    await refetch();
    onOpenChange(false);
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      // Don't clear storage if OAuth is pending
      if (!wizard.pendingOAuth) {
        // Keep state for resuming later
      }
    }
    onOpenChange(isOpen);
  };

  const currentStepInfo = stepTitles[wizard.currentStep];

  // Show step indicator
  const steps: WizardStep[] = [
    "select-installation",
    "connect-slack",
    "complete",
  ];
  const currentStepIndex = steps.indexOf(wizard.currentStep);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{currentStepInfo.title}</DialogTitle>
          <DialogDescription>{currentStepInfo.description}</DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 py-2">
          {steps.map((step, index) => (
            <div key={step} className="flex items-center">
              <div
                className={`h-2 w-2 rounded-full ${
                  index <= currentStepIndex
                    ? "bg-primary"
                    : "bg-muted-foreground/30"
                }`}
              />
              {index < steps.length - 1 && (
                <div
                  className={`h-0.5 w-8 ${
                    index < currentStepIndex
                      ? "bg-primary"
                      : "bg-muted-foreground/30"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        {wizard.currentStep === "select-installation" && (
          <StepSelectInstallation
            selectedId={wizard.installationId}
            onSelect={handleSelectInstallation}
            onNext={() => wizard.setStep("connect-slack")}
          />
        )}

        {wizard.currentStep === "connect-slack" &&
          wizard.installationId &&
          wizard.installationName && (
            <StepConnectSlack
              installationId={wizard.installationId}
              installationName={wizard.installationName}
              error={oauthError}
              onConnect={handleConnectSlack}
              onBack={() => wizard.setStep("select-installation")}
            />
          )}

        {wizard.currentStep === "complete" && (
          <StepComplete
            workspaceName={
              completedWorkspaceName ?? wizard.installationName ?? "Workspace"
            }
            onFinish={handleFinish}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
