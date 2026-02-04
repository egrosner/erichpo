import { Building2, Slack } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StepConnectSlackProps {
  installationId: number;
  installationName: string;
  error?: string | null;
  onConnect: () => void;
  onBack: () => void;
}

export function StepConnectSlack({
  installationId,
  installationName,
  error,
  onConnect,
  onBack,
}: StepConnectSlackProps) {
  return (
    <div className="space-y-4">
      <div className="p-4 bg-muted rounded-lg">
        <div className="flex items-center gap-3">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="font-medium">{installationName}</p>
            <p className="text-sm text-muted-foreground">
              GitHub Installation #{installationId}
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
        Connect your Slack workspace to enable bidirectional sync between GitHub
        PRs and Slack channels.
      </p>

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onConnect}>
          <Slack className="h-4 w-4 mr-2" />
          Connect Slack
        </Button>
      </div>
    </div>
  );
}
