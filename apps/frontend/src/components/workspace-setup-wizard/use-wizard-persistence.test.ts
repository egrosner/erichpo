import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWizardPersistence } from "./use-wizard-persistence";

const STORAGE_KEY = "erichpo_workspace_wizard_state";

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

afterEach(() => {
  localStorage.clear();
});

describe("useWizardPersistence", () => {
  it("starts with default state", () => {
    const { result } = renderHook(() => useWizardPersistence());

    expect(result.current.currentStep).toBe("select-installation");
    expect(result.current.installationId).toBeNull();
    expect(result.current.installationName).toBeNull();
    expect(result.current.pendingOAuth).toBe(false);
  });

  it("sets isLoaded after mount", async () => {
    const { result } = renderHook(() => useWizardPersistence());

    // After the useEffect runs, isLoaded should be true
    expect(result.current.isLoaded).toBe(true);
  });

  it("restores state from localStorage", () => {
    const saved = {
      currentStep: "connect-slack",
      installationId: 42,
      installationName: "my-org",
      pendingOAuth: true,
      startedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

    const { result } = renderHook(() => useWizardPersistence());

    expect(result.current.currentStep).toBe("connect-slack");
    expect(result.current.installationId).toBe(42);
    expect(result.current.installationName).toBe("my-org");
    expect(result.current.pendingOAuth).toBe(true);
  });

  it("ignores expired state (>30 min old)", () => {
    const saved = {
      currentStep: "connect-slack",
      installationId: 42,
      installationName: "my-org",
      pendingOAuth: false,
      startedAt: Date.now() - 31 * 60 * 1000, // 31 minutes ago
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

    const { result } = renderHook(() => useWizardPersistence());

    // Should fall back to default state
    expect(result.current.currentStep).toBe("select-installation");
    expect(result.current.installationId).toBeNull();
    // localStorage should be cleared
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("ignores invalid JSON in localStorage", () => {
    localStorage.setItem(STORAGE_KEY, "not json");

    const { result } = renderHook(() => useWizardPersistence());

    expect(result.current.currentStep).toBe("select-installation");
  });

  it("persists step changes to localStorage", () => {
    const { result } = renderHook(() => useWizardPersistence());

    act(() => {
      result.current.setStep("connect-slack");
    });

    expect(result.current.currentStep).toBe("connect-slack");

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) as string);
    expect(stored.currentStep).toBe("connect-slack");
  });

  it("persists installation changes to localStorage", () => {
    const { result } = renderHook(() => useWizardPersistence());

    act(() => {
      result.current.setInstallation(99, "cool-org");
    });

    expect(result.current.installationId).toBe(99);
    expect(result.current.installationName).toBe("cool-org");

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) as string);
    expect(stored.installationId).toBe(99);
    expect(stored.installationName).toBe("cool-org");
  });

  it("persists pendingOAuth changes to localStorage", () => {
    const { result } = renderHook(() => useWizardPersistence());

    act(() => {
      result.current.setPendingOAuth(true);
    });

    expect(result.current.pendingOAuth).toBe(true);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) as string);
    expect(stored.pendingOAuth).toBe(true);
  });

  it("reset clears localStorage and returns to default", () => {
    const { result } = renderHook(() => useWizardPersistence());

    act(() => {
      result.current.setStep("complete");
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.currentStep).toBe("select-installation");
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("clearStorage removes key without resetting state", () => {
    const { result } = renderHook(() => useWizardPersistence());

    act(() => {
      result.current.setStep("connect-slack");
    });

    act(() => {
      result.current.clearStorage();
    });

    // State unchanged in memory
    expect(result.current.currentStep).toBe("connect-slack");
    // But localStorage is cleared
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
