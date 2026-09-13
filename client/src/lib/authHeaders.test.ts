import { describe, expect, it, vi } from "vitest";
import { getSupabaseAuthHeaders } from "./authHeaders";

function session(access_token: string, expires_at: number) {
  return { access_token, expires_at } as never;
}

describe("getSupabaseAuthHeaders", () => {
  it("returns no authorization header without a Supabase client or session", async () => {
    expect(await getSupabaseAuthHeaders(null)).toEqual({});

    const client = {
      auth: {
        getSession: vi.fn(async () => ({
          data: { session: null },
          error: null,
        })),
        refreshSession: vi.fn(),
      },
    } as never;

    expect(await getSupabaseAuthHeaders(client)).toEqual({});
    expect(client.auth.refreshSession).not.toHaveBeenCalled();
  });

  it("attaches the current access token for a healthy session", async () => {
    const client = {
      auth: {
        getSession: vi.fn(async () => ({
          data: {
            session: session(
              "healthy-token",
              Math.floor(Date.now() / 1000) + 3600
            ),
          },
          error: null,
        })),
        refreshSession: vi.fn(),
      },
    } as never;

    expect(await getSupabaseAuthHeaders(client)).toEqual({
      Authorization: "Bearer healthy-token",
    });
    expect(client.auth.refreshSession).not.toHaveBeenCalled();
  });

  it("refreshes an expiring session before attaching its token", async () => {
    const client = {
      auth: {
        getSession: vi.fn(async () => ({
          data: {
            session: session(
              "expiring-token",
              Math.floor(Date.now() / 1000) + 10
            ),
          },
          error: null,
        })),
        refreshSession: vi.fn(async () => ({
          data: {
            session: session(
              "refreshed-token",
              Math.floor(Date.now() / 1000) + 3600
            ),
          },
          error: null,
        })),
      },
    } as never;

    expect(await getSupabaseAuthHeaders(client)).toEqual({
      Authorization: "Bearer refreshed-token",
    });
    expect(client.auth.refreshSession).toHaveBeenCalledOnce();
  });

  it("falls back to the current token when refresh fails", async () => {
    const client = {
      auth: {
        getSession: vi.fn(async () => ({
          data: {
            session: session(
              "current-token",
              Math.floor(Date.now() / 1000) + 10
            ),
          },
          error: null,
        })),
        refreshSession: vi.fn(async () => {
          throw new Error("refresh unavailable");
        }),
      },
    } as never;

    expect(await getSupabaseAuthHeaders(client)).toEqual({
      Authorization: "Bearer current-token",
    });
  });
});
