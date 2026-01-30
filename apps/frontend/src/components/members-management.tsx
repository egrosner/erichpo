import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Users, UserPlus, Trash2, ChevronsUpDown, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkspaceMember {
  userId: number;
  githubId: number;
  githubUsername: string;
  email: string | null;
  avatarUrl: string | null;
  role: "admin" | "user";
  joinedAt: string;
}

interface SlackUser {
  id: string;
  name: string;
  real_name?: string;
  email?: string;
}

interface UserMapping {
  id: number;
  githubUsername: string;
  slackUserId: string;
}

function SlackUserCombobox({
  slackUsers,
  selectedUserId,
  onSelect,
  disabled,
}: {
  slackUsers: SlackUser[];
  selectedUserId: string | null;
  onSelect: (userId: string | null) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selectedUser = selectedUserId
    ? slackUsers.find((u) => u.id === selectedUserId)
    : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-48 justify-between"
          disabled={disabled}
        >
          {selectedUser ? (
            <span className="truncate">
              {selectedUser.real_name || selectedUser.name}
            </span>
          ) : (
            <span className="text-muted-foreground">Select Slack user...</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search users..." />
          <CommandList>
            <CommandEmpty>No user found.</CommandEmpty>
            <CommandGroup>
              {selectedUserId && (
                <CommandItem
                  value="__clear__"
                  onSelect={() => {
                    onSelect(null);
                    setOpen(false);
                  }}
                >
                  <X className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Clear mapping</span>
                </CommandItem>
              )}
              {slackUsers.map((slackUser) => (
                <CommandItem
                  key={slackUser.id}
                  value={`${slackUser.name} ${slackUser.real_name || ""} ${slackUser.email || ""}`}
                  onSelect={() => {
                    onSelect(slackUser.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedUserId === slackUser.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{slackUser.real_name || slackUser.name}</span>
                    {slackUser.real_name && slackUser.name !== slackUser.real_name && (
                      <span className="text-xs text-muted-foreground">
                        @{slackUser.name}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function MembersManagement() {
  const { currentWorkspace, user } = useAuth();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "user">("user");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slackUsers, setSlackUsers] = useState<SlackUser[]>([]);
  const [userMappings, setUserMappings] = useState<UserMapping[]>([]);
  const [savingMapping, setSavingMapping] = useState<string | null>(null);

  useEffect(() => {
    fetchMembers();
    fetchSlackUsers();
    fetchUserMappings();
  }, [currentWorkspace?.workspaceId]);

  const fetchMembers = async () => {
    if (!currentWorkspace) return;

    setError(null);

    try {
      setLoading(true);
      const res = await fetch("/api/admin/members", { credentials: "include" });
      if (res.ok) {
        setMembers(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch members:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSlackUsers = async () => {
    if (!currentWorkspace) return;

    try {
      const res = await fetch("/api/admin/slack-users", { credentials: "include" });
      if (res.ok) {
        setSlackUsers(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch Slack users:", err);
    }
  };

  const fetchUserMappings = async () => {
    if (!currentWorkspace) return;

    try {
      const res = await fetch("/api/admin/user-mappings", { credentials: "include" });
      if (res.ok) {
        setUserMappings(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch user mappings:", err);
    }
  };

  const handleMappingChange = async (githubUsername: string, slackUserId: string | null) => {
    setSavingMapping(githubUsername);
    setError(null);

    try {
      if (slackUserId) {
        const res = await fetch("/api/admin/user-mappings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ githubUsername, slackUserId }),
        });

        if (res.ok) {
          await fetchUserMappings();
        } else {
          const data = await res.json();
          setError(data.message || "Failed to save mapping");
        }
      } else {
        const res = await fetch(`/api/admin/user-mappings/${encodeURIComponent(githubUsername)}`, {
          method: "DELETE",
          credentials: "include",
        });

        if (res.ok) {
          await fetchUserMappings();
        } else {
          const data = await res.json();
          setError(data.message || "Failed to remove mapping");
        }
      }
    } catch (err) {
      setError("Failed to update mapping");
    } finally {
      setSavingMapping(null);
    }
  };

  const getMappedSlackUserId = (githubUsername: string): string | null => {
    const mapping = userMappings.find((m) => m.githubUsername === githubUsername);
    return mapping?.slackUserId ?? null;
  };

  const handleInvite = async () => {
    if (!inviteUsername.trim()) return;

    setInviting(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/members/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          githubUsername: inviteUsername.trim(),
          role: inviteRole,
        }),
      });

      if (res.ok) {
        setInviteUsername("");
        await fetchMembers();
      } else {
        const data = await res.json();
        setError(data.message || "Failed to invite user");
      }
    } catch (err) {
      setError("Failed to invite user");
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (targetUserId: number, newRole: "admin" | "user") => {
    setError(null);

    try {
      const res = await fetch(`/api/admin/members/${targetUserId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role: newRole }),
      });

      if (res.ok) {
        await fetchMembers();
      } else {
        const data = await res.json();
        setError(data.message || "Failed to update role");
      }
    } catch (err) {
      setError("Failed to update role");
    }
  };

  const handleRemove = async (targetUserId: number, username: string) => {
    if (!confirm(`Remove ${username} from the workspace?`)) return;

    setError(null);

    try {
      const res = await fetch(`/api/admin/members/${targetUserId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (res.ok) {
        await fetchMembers();
      } else {
        const data = await res.json();
        setError(data.message || "Failed to remove member");
      }
    } catch (err) {
      setError("Failed to remove member");
    }
  };

  if (!currentWorkspace) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <CardTitle>Workspace Members</CardTitle>
        </div>
        <CardDescription>
          Manage who has access to {currentWorkspace.teamName}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="p-3 text-sm bg-destructive/10 text-destructive rounded-md">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <Input
            placeholder="GitHub username"
            value={inviteUsername}
            onChange={(e) => setInviteUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleInvite()}
          />
          <Select
            value={inviteRole}
            onValueChange={(v) => setInviteRole(v as "admin" | "user")}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="user">User</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleInvite} disabled={inviting || !inviteUsername.trim()}>
            <UserPlus className="h-4 w-4 mr-2" />
            Invite
          </Button>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">Loading members...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Slack User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.userId}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {member.avatarUrl && (
                        <img
                          src={member.avatarUrl}
                          alt={member.githubUsername}
                          className="h-8 w-8 rounded-full"
                        />
                      )}
                      <div>
                        <div className="font-medium">
                          {member.githubUsername}
                          {member.userId === user?.id && (
                            <Badge variant="secondary" className="ml-2">
                              You
                            </Badge>
                          )}
                        </div>
                        {member.email && (
                          <div className="text-sm text-muted-foreground">
                            {member.email}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <SlackUserCombobox
                      slackUsers={slackUsers}
                      selectedUserId={getMappedSlackUserId(member.githubUsername)}
                      onSelect={(slackUserId) =>
                        handleMappingChange(member.githubUsername, slackUserId)
                      }
                      disabled={savingMapping === member.githubUsername}
                    />
                  </TableCell>
                  <TableCell>
                    {member.userId === user?.id ? (
                      <Badge variant={member.role === "admin" ? "default" : "secondary"}>
                        {member.role}
                      </Badge>
                    ) : (
                      <Select
                        value={member.role}
                        onValueChange={(v) =>
                          handleRoleChange(member.userId, v as "admin" | "user")
                        }
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">user</SelectItem>
                          <SelectItem value="admin">admin</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell>
                    {member.userId !== user?.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemove(member.userId, member.githubUsername)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
