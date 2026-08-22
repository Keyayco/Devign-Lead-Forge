import type { Request } from "express";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
export type SupabaseUser = NonNullable<Awaited<ReturnType<SupabaseClient["auth"]["getUser"]>>["data"]["user"]>;
import { ENV } from "./_core/env";

function requireSupabaseConfig() {
  if (!ENV.supabaseUrl || !ENV.supabasePublishableKey) {
    throw new Error("Supabase Auth is not configured");
  }
  return {
    url: ENV.supabaseUrl,
    key: ENV.supabasePublishableKey,
  };
}

export function createSupabaseRequestClient(accessToken: string): SupabaseClient {
  const { url, key } = requireSupabaseConfig();
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

export function getBearerToken(req: Request): string | null {
  const authorization = req.headers.authorization;
  const authHeader = Array.isArray(authorization) ? authorization[0] : authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;
  const accessToken = authHeader.slice("Bearer ".length).trim();
  return accessToken || null;
}

export async function getSupabaseUserFromRequest(req: Request): Promise<SupabaseUser | null> {
  const accessToken = getBearerToken(req);
  if (!accessToken) return null;

  try {
    const client = createSupabaseRequestClient(accessToken);
    const authClient = client.auth as unknown as { getUser: () => Promise<{ data: { user: SupabaseUser | null }, error: any }> };
    const { data, error } = await authClient.getUser();
    if (error || !data.user) return null;
    return data.user;
  } catch {
    return null;
  }
}
