import type { Request } from "express";
import { createClient, type SupabaseClient, type User as SupabaseUser } from "@supabase/supabase-js";
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
  if (!authorization?.startsWith("Bearer ")) return null;
  const accessToken = authorization.slice("Bearer ".length).trim();
  return accessToken || null;
}

export async function getSupabaseUserFromRequest(req: Request): Promise<SupabaseUser | null> {
  const accessToken = getBearerToken(req);
  if (!accessToken) return null;

  try {
    const { data, error } = await createSupabaseRequestClient(accessToken).auth.getUser();
    if (error || !data.user) return null;
    return data.user;
  } catch {
    return null;
  }
}
