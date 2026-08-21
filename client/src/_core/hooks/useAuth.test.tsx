// @vitest-environment jsdom

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, act, waitFor, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { trpc } from "@/lib/trpc";

let currentMockSession: any = null;
let registeredAuthListener: ((event: string, session: any) => void) | null = null;

vi.mock("@/lib/supabase", () => {
  return {
    supabase: {
      auth: {
        getSession: vi.fn(async () => ({ data: { session: currentMockSession }, error: null })),
        onAuthStateChange: vi.fn((callback) => {
          registeredAuthListener = callback;
          return {
            data: {
              subscription: {
                unsubscribe: vi.fn(),
              },
            },
          };
        }),
        signInWithPassword: vi.fn(async ({ email }) => {
          if (email === "fail@example.com") {
            return { data: { session: null, user: null }, error: new Error("Invalid credentials") };
          }
          currentMockSession = {
            access_token: "mock-token-123",
            user: { id: "user-uuid-1", email },
          };
          registeredAuthListener?.("SIGNED_IN", currentMockSession);
          return { data: { session: currentMockSession, user: currentMockSession.user }, error: null };
        }),
        signOut: vi.fn(async () => {
          currentMockSession = null;
          registeredAuthListener?.("SIGNED_OUT", null);
          return { error: null };
        }),
      },
    },
    requireSupabaseAuth: () => ({
      auth: {
        signInWithPassword: async ({ email }: any) => {
          if (email === "fail@example.com") {
            return { data: { session: null, user: null }, error: new Error("Invalid credentials") };
          }
          currentMockSession = {
            access_token: "mock-token-123",
            user: { id: "user-uuid-1", email },
          };
          registeredAuthListener?.("SIGNED_IN", currentMockSession);
          return { data: { session: currentMockSession, user: currentMockSession.user }, error: null };
        },
        signUp: async () => ({ data: { session: null, user: null }, error: null }),
      },
    }),
    SUPABASE_AUTH_NOT_CONFIGURED: "Supabase Auth is not configured",
  };
});

import { AuthProvider, useAuth } from "./useAuth";

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const client = trpc.createClient({
    links: [httpBatchLink({ url: "http://localhost:3000/api/trpc", transformer: superjson })],
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <trpc.Provider client={client} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>{children}</AuthProvider>
        </QueryClientProvider>
      </trpc.Provider>
    );
  };
}

describe("useAuth comprehensive lifecycle", () => {
  beforeEach(() => {
    currentMockSession = null;
    registeredAuthListener = null;
    vi.clearAllMocks();
  });

  it("starts in loading state and resolves unauthenticated when no session exists", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    expect(result.current.loading).toBe(true);
    expect(result.current.authStatus).toBe("loading");

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.authStatus).toBe("unauthenticated");
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.session).toBeNull();
  });

  it("restores session successfully on authenticated startup (refresh persistence)", async () => {
    currentMockSession = {
      access_token: "restored-token-999",
      user: { id: "user-uuid-1", email: "agent@example.com" },
    };

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.session?.access_token).toBe("restored-token-999");
    expect(result.current.authStatus).toBe("authenticated");
  });

  it("accepts INITIAL_SESSION with a persisted session and keeps the workspace authenticated", async () => {
    currentMockSession = {
      access_token: "initial-session-token",
      user: { id: "user-uuid-1", email: "agent@example.com" },
    };

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      registeredAuthListener?.("INITIAL_SESSION", currentMockSession);
    });

    expect(result.current.authStatus).toBe("authenticated");
    expect(result.current.session?.access_token).toBe("initial-session-token");
  });

  it("handles successful sign-in and updates auth state deterministically", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.login({ email: "agent@example.com", password: "password123" });
    });

    expect(result.current.session).not.toBeNull();
    expect(result.current.authStatus).toBe("authenticated");
    expect(result.current.supabaseUser?.email).toBe("agent@example.com");
  });

  it("keeps the user unauthenticated and exposes the safe Supabase error after failed sign-in", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.authStatus).toBe("unauthenticated");
    });

    await expect(
      result.current.login({ email: "fail@example.com", password: "wrong-password" }),
    ).rejects.toThrow("Invalid credentials");

    expect(result.current.authStatus).toBe("unauthenticated");
    expect(result.current.session).toBeNull();
  });

  it("handles token refresh and SIGNED_OUT correctly", async () => {
    currentMockSession = {
      access_token: "token-initial",
      user: { id: "user-uuid-1", email: "agent@example.com" },
    };

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      currentMockSession = {
        access_token: "token-refreshed",
        user: { id: "user-uuid-1", email: "agent@example.com" },
      };
      registeredAuthListener?.("TOKEN_REFRESHED", currentMockSession);
    });

    expect(result.current.session?.access_token).toBe("token-refreshed");

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.session).toBeNull();
    expect(result.current.authStatus).toBe("unauthenticated");
  });

  it("suppresses protected queries and renders deterministic UI without blank state across auth transitions", async () => {
    function TestComponent() {
      const { authStatus, isAuthenticated } = useAuth();
      const query = trpc.leads.list.useQuery(undefined, { enabled: isAuthenticated });

      return (
        <div>
          <span data-testid="status">{authStatus}</span>
          <span data-testid="fetching">{query.isFetching ? "fetching" : "idle"}</span>
        </div>
      );
    }

    render(
      <React.StrictMode>
        <TestComponent />
      </React.StrictMode>,
      { wrapper: createWrapper() },
    );

    // Initial loading state should render deterministic status and suppress query fetch
    expect(screen.getByTestId("status").textContent).toBe("loading");
    expect(screen.getByTestId("fetching").textContent).toBe("idle");

    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("unauthenticated");
    });
    expect(screen.getByTestId("fetching").textContent).toBe("idle");
  });
});
