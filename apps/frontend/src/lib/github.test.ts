import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getGitHubInstallUrl,
  getGitHubInstallUrlForLink,
  getGitHubInstallUrlForNewWorkspace,
} from "./github";

describe("getGitHubInstallUrl", () => {
  beforeEach(() => {
    vi.stubEnv(
      "VITE_GITHUB_APP_URL",
      "https://github.com/apps/test-app/installations/new",
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns null when VITE_GITHUB_APP_URL is not set", () => {
    vi.stubEnv("VITE_GITHUB_APP_URL", "");
    expect(getGitHubInstallUrl()).toBeNull();
  });

  it("returns base URL when no state is provided", () => {
    expect(getGitHubInstallUrl()).toBe(
      "https://github.com/apps/test-app/installations/new",
    );
  });

  it("encodes state as base64 JSON in the URL", () => {
    const state = { intent: "link" as const, workspaceId: 42 };
    const url = getGitHubInstallUrl(state) as string;
    expect(url).toBeTruthy();

    const parsed = new URL(url);
    const stateParam = parsed.searchParams.get("state") as string;
    expect(stateParam).toBeTruthy();

    const decoded = JSON.parse(atob(stateParam));
    expect(decoded).toEqual({ intent: "link", workspaceId: 42 });
  });
});

describe("getGitHubInstallUrlForLink", () => {
  beforeEach(() => {
    vi.stubEnv(
      "VITE_GITHUB_APP_URL",
      "https://github.com/apps/test-app/installations/new",
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("encodes link intent with workspaceId and returnTo", () => {
    const url = getGitHubInstallUrlForLink(7) as string;
    const parsed = new URL(url);
    const decoded = JSON.parse(
      atob(parsed.searchParams.get("state") as string),
    );

    expect(decoded).toEqual({
      intent: "link",
      workspaceId: 7,
      returnTo: "/dashboard",
    });
  });
});

describe("getGitHubInstallUrlForNewWorkspace", () => {
  beforeEach(() => {
    vi.stubEnv(
      "VITE_GITHUB_APP_URL",
      "https://github.com/apps/test-app/installations/new",
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("encodes new_workspace intent with returnTo", () => {
    const url = getGitHubInstallUrlForNewWorkspace() as string;
    const parsed = new URL(url);
    const decoded = JSON.parse(
      atob(parsed.searchParams.get("state") as string),
    );

    expect(decoded).toEqual({
      intent: "new_workspace",
      returnTo: "/no-workspace",
    });
  });
});
