import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Settings, AtSign, UserPlus } from "lucide-react";

interface UserPreferences {
  slackMentions: boolean;
  slackInvites: boolean;
}

export function UserPreferences() {
  const { currentWorkspace } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPreferences();
  }, [currentWorkspace?.workspaceId]);

  const fetchPreferences = async () => {
    if (!currentWorkspace) return;

    setError(null);

    try {
      setLoading(true);
      const res = await fetch("/api/preferences", { credentials: "include" });
      if (res.ok) {
        setPreferences(await res.json());
      } else {
        setError("Failed to load preferences");
      }
    } catch (err) {
      console.error("Failed to fetch preferences:", err);
      setError("Failed to load preferences");
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = async (
    key: keyof UserPreferences,
    value: boolean
  ) => {
    if (!preferences) return;

    setUpdating(key);
    setError(null);

    // Optimistically update the UI
    setPreferences((prev) => (prev ? { ...prev, [key]: value } : null));

    try {
      const res = await fetch("/api/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ [key]: value }),
      });

      if (!res.ok) {
        // Revert on error
        setPreferences((prev) => (prev ? { ...prev, [key]: !value } : null));
        const data = await res.json();
        setError(data.message || "Failed to update preference");
      }
    } catch (err) {
      // Revert on error
      setPreferences((prev) => (prev ? { ...prev, [key]: !value } : null));
      setError("Failed to update preference");
    } finally {
      setUpdating(null);
    }
  };

  if (!currentWorkspace) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          <CardTitle>Notification Preferences</CardTitle>
        </div>
        <CardDescription>
          Control how you receive Slack notifications for {currentWorkspace.teamName}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="p-3 text-sm bg-destructive/10 text-destructive rounded-md">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-sm text-muted-foreground">
            Loading preferences...
          </div>
        ) : preferences ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AtSign className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="font-medium">Slack Mentions</div>
                  <div className="text-sm text-muted-foreground">
                    Allow @mentions to notify you in Slack when your GitHub
                    username is mentioned
                  </div>
                </div>
              </div>
              <Switch
                checked={preferences.slackMentions}
                onCheckedChange={(checked) =>
                  updatePreference("slackMentions", checked)
                }
                disabled={updating === "slackMentions"}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <UserPlus className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="font-medium">Channel Invites</div>
                  <div className="text-sm text-muted-foreground">
                    Automatically join Slack channels for PRs you author or
                    review
                  </div>
                </div>
              </div>
              <Switch
                checked={preferences.slackInvites}
                onCheckedChange={(checked) =>
                  updatePreference("slackInvites", checked)
                }
                disabled={updating === "slackInvites"}
              />
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
