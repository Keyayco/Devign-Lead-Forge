import type { SupabaseClient } from "@supabase/supabase-js";

type SupabaseAuthClient = Pick<SupabaseClient, "auth">;

export async function getSupabaseAuthHeaders(
  client: SupabaseAuthClient | null
): Promise<Record<string, string>> {
  if (!client) return {};

  let currentSession;
  try {
    const result = await client.auth.getSession();
    currentSession = result.data.session;
  } catch {
    return {};
  }

  const expiresSoon = Boolean(
    currentSession?.expires_at &&
      currentSession.expires_at <= Math.floor(Date.now() / 1000) + 30
  );

  let session = currentSession;
  if (expiresSoon) {
    try {
      session =
        (await client.auth.refreshSession()).data.session ?? currentSession;
    } catch {
      session = currentSession;
    }
  }

  return session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : {};
}
