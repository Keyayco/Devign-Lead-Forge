// @vitest-environment jsdom

import * as React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseAuth = vi.fn();

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

import DashboardLayout from "./DashboardLayout";

describe("DashboardLayout authentication boundary", () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    mockUseAuth.mockReset();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it("renders the authenticated workspace instead of the login panel", () => {
    mockUseAuth.mockReturnValue({
      loading: false,
      authStatus: "authenticated",
      user: { id: "profile-uuid", name: "Agent One", email: "agent@example.com" },
      logout: vi.fn(),
    });

    render(
      <DashboardLayout>
        <div>workspace-marker</div>
      </DashboardLayout>,
    );

    expect(screen.getByText("workspace-marker").textContent).toBe("workspace-marker");
    expect(screen.queryByText("Welcome back")).toBeNull();
    expect(screen.queryByText("Need an account? Create one")).toBeNull();
  });

  it("renders a deterministic login panel for unauthenticated state", () => {
    mockUseAuth.mockReturnValue({
      loading: false,
      authStatus: "unauthenticated",
      user: null,
      logout: vi.fn(),
    });

    render(
      <DashboardLayout>
        <div>workspace-marker</div>
      </DashboardLayout>,
    );

    expect(screen.getByText("Welcome back").textContent).toBe("Welcome back");
    expect(screen.queryByText("workspace-marker")).toBeNull();
  });
});
