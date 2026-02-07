import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth";
import {
  AtSign,
  Link,
  MessageSquare,
  Settings,
  Unlink,
  UserPlus,
} from "lucide-react";
import { useEffect, useState } from "react";

interface UserPreferences {
  slackMentions: boolean;
  slackInvites: boolean;
  slackConnected: boolean;
  slackUserId: string | null;
}

export function UserPreferences() {
  const { currentWorkspace } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    // Clear stale preferences from previous workspace before fetching
    setPreferences(null);
    fetchPreferences();

    // Check URL params for Slack connection result
    const params = new URLSearchParams(window.location.search);
    const slackConnected = params.get("slack_connected");
    const slackError = params.get("slack_connect_error");

    if (slackConnected === "true") {
      setSuccessMessage("Slack account connected successfully!");
      // Clean up URL
      window.history.replaceState({}, "", window.location.pathname);
    } else if (slackError) {
      setError(`Failed to connect Slack: ${slackError}`);
      // Clean up URL
      window.history.replaceState({}, "", window.location.pathname);
    }
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
    key: "slackMentions" | "slackInvites",
    value: boolean,
  ) => {
    if (!preferences) return;

    setUpdating(key);
    setError(null);
    setSuccessMessage(null);

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

  const connectSlack = () => {
    // Redirect to Slack OAuth
    window.location.href = "/api/oauth/slack/user/connect";
  };

  const disconnectSlack = async () => {
    if (!preferences) return;

    setDisconnecting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch("/api/oauth/slack/user/disconnect", {
        method: "POST",
        credentials: "include",
      });

      if (res.ok) {
        setPreferences((prev) =>
          prev ? { ...prev, slackConnected: false, slackUserId: null } : null,
        );
        setSuccessMessage("Slack account disconnected");
      } else {
        const data = await res.json();
        setError(data.message || "Failed to disconnect Slack");
      }
    } catch (err) {
      setError("Failed to disconnect Slack");
    } finally {
      setDisconnecting(false);
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
          Control how you receive Slack notifications for{" "}
          {currentWorkspace.teamName}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="p-3 text-sm bg-destructive/10 text-destructive rounded-md">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="p-3 text-sm bg-green-500/10 text-green-700 dark:text-green-400 rounded-md">
            {successMessage}
          </div>
        )}

        {loading ? (
          <div className="text-sm text-muted-foreground">
            Loading preferences...
          </div>
        ) : preferences ? (
          <div className="space-y-6">
            {/* Slack Account Connection */}
            <div className="pb-4 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MessageSquare className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Slack Account</span>
                      {preferences.slackConnected ? (
                        <Badge variant="default" className="bg-green-600">
                          Connected
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Not Connected</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {preferences.slackConnected
                        ? "Your GitHub comments will appear as you in Slack"
                        : "Connect to post messages as yourself instead of the bot"}
                    </div>
                  </div>
                </div>
                {preferences.slackConnected ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={disconnectSlack}
                    disabled={disconnecting}
                  >
                    <Unlink className="h-4 w-4 mr-2" />
                    {disconnecting ? "Disconnecting..." : "Disconnect"}
                  </Button>
                ) : (
                  <Button variant="default" size="sm" onClick={connectSlack}>
                    <Link className="h-4 w-4 mr-2" />
                    Connect Slack
                  </Button>
                )}
              </div>
            </div>

            {/* Notification Preferences */}
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
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
