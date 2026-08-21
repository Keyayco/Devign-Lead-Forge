// @vitest-environment jsdom

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { trpc } from "@/lib/trpc";
vi.mock("@/lib/supabase", () => ({
  supabase: null,
  requireSupabaseAuth: () => {
    throw new Error("Supabase Auth is not configured");
  },
}));

import { useAuth } from "./useAuth";

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const client = trpc.createClient({
    links: [httpBatchLink({ url: "http://localhost:3000/api/trpc", transformer: superjson })],
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <trpc.Provider client={client} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </trpc.Provider>
    );
  };
}

describe("useAuth Supabase configuration boundary", () => {
  it("rejects sign-up with the configuration error when the browser client is unavailable", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await expect(
      result.current.signUp({
        email: "agent@example.com",
        password: "password123",
        fullName: "Test Agent",
      }),
    ).rejects.toThrow("Supabase Auth is not configured");
  });
});
