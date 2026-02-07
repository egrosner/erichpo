import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

interface StepCompleteProps {
  workspaceName: string;
  onFinish: () => void;
}

export function StepComplete({ workspaceName, onFinish }: StepCompleteProps) {
  return (
    <div className="space-y-4 text-center py-4">
      <div className="flex justify-center">
        <CheckCircle2 className="h-12 w-12 text-green-500" />
      </div>

      <div>
        <h3 className="text-lg font-semibold">Workspace Connected</h3>
        <p className="text-sm text-muted-foreground mt-1">
          <span className="font-medium">{workspaceName}</span> has been
          successfully connected.
        </p>
      </div>

      <p className="text-sm text-muted-foreground">
        PRs from linked GitHub repositories will now automatically create Slack
        channels.
      </p>

      <div className="pt-2">
        <Button onClick={onFinish}>Go to Dashboard</Button>
      </div>
    </div>
  );
}
