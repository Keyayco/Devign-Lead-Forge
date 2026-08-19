import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { getUserByAuthUserId, upsertUser } from "../db";
import { getSupabaseUserFromRequest } from "../supabaseAuth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions,
): Promise<TrpcContext> {
  let user: User | null = null;
  const authUser = await getSupabaseUserFromRequest(opts.req);

  if (authUser) {
    await upsertUser({
      authUserId: authUser.id,
      name: authUser.user_metadata?.full_name ?? authUser.user_metadata?.name ?? null,
      email: authUser.email ?? null,
      loginMethod: "password",
      lastSignedIn: new Date(),
    });
    user = (await getUserByAuthUserId(authUser.id)) ?? null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
