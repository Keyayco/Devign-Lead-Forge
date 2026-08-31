import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { getUserByAuthUserId, upsertUser, type ProfileRow } from "../db.js";
import { getBearerToken, getSupabaseUserFromRequest } from "../supabaseAuth.js";

export type AuthenticatedUser = {
  id: string;
  authUserId: string;
  email: string | null;
  name: string | null;
  role: string;
  loginMethod: "password";
  createdAt: Date | null;
  updatedAt: Date | null;
  lastSignedIn: Date;
};

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: AuthenticatedUser | null;
  accessToken: string | null;
};

function toDate(value: string | null | undefined): Date | null {
  return value ? new Date(value) : null;
}

function toAuthenticatedUser(profile: ProfileRow, authUserId: string): AuthenticatedUser {
  return {
    id: profile.id,
    authUserId,
    email: profile.email,
    name: profile.full_name,
    role: profile.role,
    loginMethod: "password",
    createdAt: toDate(profile.created_at),
    updatedAt: toDate(profile.updated_at),
    lastSignedIn: new Date(),
  };
}

export async function createContext(
  opts: CreateExpressContextOptions,
): Promise<TrpcContext> {
  const accessToken = getBearerToken(opts.req);
  if (!accessToken) {
    return { req: opts.req, res: opts.res, user: null, accessToken: null };
  }

  const authUser = await getSupabaseUserFromRequest(opts.req);
  if (!authUser) {
    return { req: opts.req, res: opts.res, user: null, accessToken };
  }

  const profile =
    (await getUserByAuthUserId(authUser.id)) ??
    (await upsertUser({
      authUserId: authUser.id,
      name: authUser.user_metadata?.full_name ?? authUser.user_metadata?.name ?? null,
      email: authUser.email ?? null,
    }));

  return {
    req: opts.req,
    res: opts.res,
    user: toAuthenticatedUser(profile, authUser.id),
    accessToken,
  };
}
