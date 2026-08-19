import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { createContext } from "./_core/context";
import * as auth from "./supabaseAuth";
import * as db from "./db";

vi.mock("./supabaseAuth", () => ({
  getSupabaseUserFromRequest: vi.fn(),
}));

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

  it("maps a verified Supabase UUID into the internal agent profile", async () => {
    vi.mocked(auth.getSupabaseUserFromRequest).mockResolvedValue({
      id: "supabase-uuid-123",
      email: "agent@example.com",
      user_metadata: { full_name: "Agent Example" },
    } as never);
    const internalUser = {
      id: 12,
      authUserId: "supabase-uuid-123",
      name: "Agent Example",
      email: "agent@example.com",
      loginMethod: "password",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
    vi.mocked(db.getUserByAuthUserId).mockResolvedValue(internalUser);

    const context = await createContext({
      req: { headers: { authorization: "Bearer test-access-token" } } as never,
      res: {} as never,
      info: {} as never,
    });

    expect(db.upsertUser).toHaveBeenCalledWith({
      authUserId: "supabase-uuid-123",
      name: "Agent Example",
      email: "agent@example.com",
      loginMethod: "password",
      lastSignedIn: expect.any(Date),
    });
    expect(db.getUserByAuthUserId).toHaveBeenCalledWith("supabase-uuid-123");
    expect(context.user).toEqual(internalUser);
  });
});
