import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const SUPABASE_AUTH_NOT_CONFIGURED = "Supabase Auth is not configured";

export function requireSupabaseAuth(client: SupabaseClient | null): SupabaseClient {
  if (!client) throw new Error(SUPABASE_AUTH_NOT_CONFIGURED);
  return client;
}

type SupabaseConfig = {
  url?: string;
  publishableKey?: string;
};

type RuntimeEnv = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
};

function normalize(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || /^%VITE_[A-Z0-9_]+%$/.test(trimmed)) return undefined;
  return trimmed;
}

export function resolveSupabaseConfig(
  buildEnv: RuntimeEnv,
  runtimeEnv: RuntimeEnv = typeof window !== "undefined" ? window.__ENV__ ?? {} : {},
): SupabaseConfig {
  return {
    url: normalize(buildEnv.VITE_SUPABASE_URL) ?? normalize(runtimeEnv.VITE_SUPABASE_URL),
    publishableKey:
      normalize(buildEnv.VITE_SUPABASE_PUBLISHABLE_KEY) ??
      normalize(runtimeEnv.VITE_SUPABASE_PUBLISHABLE_KEY),
  };
}

declare global {
  interface Window {
    __ENV__?: RuntimeEnv;
  }
}

const config = resolveSupabaseConfig({
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
});

export const supabase =
  config.url && config.publishableKey
    ? createClient(config.url, config.publishableKey, {
        auth: {
          autoRefreshToken: true,
          detectSessionInUrl: false,
          persistSession: true,
        },
      })
    : null;
