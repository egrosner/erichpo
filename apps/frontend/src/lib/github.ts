interface GitHubInstallState {
  intent: "link" | "new_workspace";
  workspaceId?: number;
  returnTo?: string;
}

/**
 * Generates a GitHub App installation URL with encoded state.
 * The state is passed back to our setup callback after installation.
 */
export function getGitHubInstallUrl(state?: GitHubInstallState): string | null {
  const baseUrl = import.meta.env.VITE_GITHUB_APP_URL;
  if (!baseUrl) return null;

  if (!state) {
    return baseUrl;
  }

  // Encode state as base64 JSON
  const stateJson = JSON.stringify(state);
  const stateBase64 = btoa(stateJson);

  // Append state to URL
  const url = new URL(baseUrl);
  url.searchParams.set("state", stateBase64);
  return url.toString();
}

/**
 * Creates a URL for linking a GitHub installation to an existing workspace.
 */
export function getGitHubInstallUrlForLink(workspaceId: number): string | null {
  return getGitHubInstallUrl({
    intent: "link",
    workspaceId,
    returnTo: "/dashboard",
  });
}

/**
 * Creates a URL for installing GitHub App for a new workspace setup.
 */
export function getGitHubInstallUrlForNewWorkspace(): string | null {
  return getGitHubInstallUrl({
    intent: "new_workspace",
    returnTo: "/no-workspace",
  });
}
