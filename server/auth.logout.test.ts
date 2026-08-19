import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("auth.me", () => {
  it("returns the authenticated internal agent profile from context", async () => {
    const user = {
      id: 1,
      authUserId: "supabase-user-id",
      email: "agent@example.com",
      name: "Sample Agent",
      loginMethod: "password",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };

    const ctx: TrpcContext = {
      user,
      req: {} as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };

    const result = await appRouter.createCaller(ctx).auth.me();
    expect(result).toEqual(user);
  });
});
