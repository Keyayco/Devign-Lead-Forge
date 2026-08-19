import { createClient, type User as SupabaseUser } from "@supabase/supabase-js";
import type { Request } from "express";
import { ENV } from "./_core/env";

let _client: ReturnType<typeof createClient> | null = null;

function getSupabaseAuthClient() {
  if (!_client) {
    if (!ENV.supabaseUrl || !ENV.supabasePublishableKey) {
      throw new Error("Supabase Auth is not configured");
    }

    _client = createClient(ENV.supabaseUrl, ENV.supabasePublishableKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
  }
  return _client;
}

export async function getSupabaseUserFromRequest(req: Request): Promise<SupabaseUser | null> {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) return null;

  const accessToken = authorization.slice("Bearer ".length).trim();
  if (!accessToken) return null;

  try {
    const { data, error } = await getSupabaseAuthClient().auth.getUser(accessToken);
    if (error || !data.user) return null;
    return data.user;
  } catch {
    return null;
  }
}
