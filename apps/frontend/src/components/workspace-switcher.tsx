import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WorkspaceSetupWizard } from "@/components/workspace-setup-wizard";
import { useAuth } from "@/lib/auth";
import { Building2, Check, ChevronDown, Plus } from "lucide-react";
import { useState } from "react";

export function WorkspaceSwitcher() {
  const { workspaces, currentWorkspace, switchWorkspace } = useAuth();
  const [switching, setSwitching] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

  // Don't show switcher if user has 0 workspaces
  if (workspaces.length === 0) {
    return null;
  }

  const handleSwitch = async (workspaceId: number) => {
    if (workspaceId === currentWorkspace?.workspaceId || switching) return;

    setSwitching(true);
    try {
      await switchWorkspace(workspaceId);
    } catch (error) {
      console.error("Failed to switch workspace:", error);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={switching}>
            <Building2 className="h-4 w-4 mr-2" />
            <span className="max-w-[150px] truncate">
              {currentWorkspace?.teamName ?? "Select workspace"}
            </span>
            <ChevronDown className="h-4 w-4 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Switch workspace</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {workspaces.map((workspace) => (
            <DropdownMenuItem
              key={workspace.workspaceId}
              onClick={() => handleSwitch(workspace.workspaceId)}
              className="flex items-center justify-between"
            >
              <span className="truncate">{workspace.teamName}</span>
              {workspace.workspaceId === currentWorkspace?.workspaceId && (
                <Check className="h-4 w-4 ml-2 flex-shrink-0" />
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setWizardOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <WorkspaceSetupWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </>
  );
}
