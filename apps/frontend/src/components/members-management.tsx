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
import { Badge } from "@/components/ui/badge";
import { Users, UserPlus, Trash2 } from "lucide-react";

interface WorkspaceMember {
  userId: number;
  githubId: number;
  githubUsername: string;
  email: string | null;
  avatarUrl: string | null;
  role: "admin" | "user";
  joinedAt: string;
}

export function MembersManagement() {
  const { currentWorkspace, user } = useAuth();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "user">("user");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMembers();
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
