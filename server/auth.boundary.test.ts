import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { createContext } from "./_core/context";
import * as auth from "./supabaseAuth";
import * as db from "./db";

vi.mock("./supabaseAuth", async importOriginal => {
  const actual = await importOriginal<typeof import("./supabaseAuth")>();
  return {
    ...actual,
    getBearerToken: vi.fn(() => "test-access-token"),
    getSupabaseUserFromRequest: vi.fn(),
  };
});

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getUserByAuthUserId: vi.fn(),
    upsertUser: vi.fn(),
  };
});

const emptyContext = (): TrpcContext => ({
  user: null,
  accessToken: null,
  req: { headers: {} } as TrpcContext["req"],
  res: {} as TrpcContext["res"],
});

describe("Supabase Auth authorization boundary", () => {
  it("rejects protected lead procedures without an authenticated context", async () => {
    const caller = appRouter.createCaller(emptyContext());

    await expect(
      caller.leads.list({ search: undefined, type: "all", claimStatus: "all" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("maps a verified Supabase UUID into the internal profile user", async () => {
    vi.mocked(auth.getSupabaseUserFromRequest).mockResolvedValue({
      id: "00000000-0000-0000-0000-000000000123",
      email: "agent@example.com",
      user_metadata: { full_name: "Agent Example" },
    } as never);
    const profile = {
      id: "00000000-0000-0000-0000-000000000123",
      full_name: "Agent Example",
      email: "agent@example.com",
      role: "user",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    vi.mocked(db.getUserByAuthUserId).mockResolvedValue(profile);

    const context = await createContext({
      req: { headers: { authorization: "Bearer test-access-token" } } as never,
      res: {} as never,
      info: {} as never,
    });

    expect(db.getUserByAuthUserId).toHaveBeenCalledWith(
      "00000000-0000-0000-0000-000000000123",
    );
    expect(db.upsertUser).not.toHaveBeenCalled();
    expect(context.accessToken).toBe("test-access-token");
    expect(context.user).toMatchObject({
      id: "00000000-0000-0000-0000-000000000123",
      authUserId: "00000000-0000-0000-0000-000000000123",
      name: "Agent Example",
      email: "agent@example.com",
      role: "user",
      loginMethod: "password",
    });
  });
});
