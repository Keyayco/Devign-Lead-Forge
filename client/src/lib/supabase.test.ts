import { describe, expect, it } from "vitest";
import { requireSupabaseAuth, resolveSupabaseConfig } from "./supabase";

describe("resolveSupabaseConfig", () => {
  it("uses Vite build-time variables when present", () => {
    expect(
      resolveSupabaseConfig({
        VITE_SUPABASE_URL: "https://example.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
      }),
    ).toEqual({
      url: "https://example.supabase.co",
      publishableKey: "sb_publishable_example",
    });
  });

  it("falls back to runtime-injected variables", () => {
    expect(
      resolveSupabaseConfig(
        {},
        {
          VITE_SUPABASE_URL: "https://runtime.supabase.co",
          VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_runtime",
        },
      ),
    ).toEqual({
      url: "https://runtime.supabase.co",
      publishableKey: "sb_publishable_runtime",
    });
  });

  it("rejects missing and unreplaced Vite placeholders", () => {
    expect(
      resolveSupabaseConfig({
        VITE_SUPABASE_URL: "%VITE_SUPABASE_URL%",
        VITE_SUPABASE_PUBLISHABLE_KEY: "%VITE_SUPABASE_PUBLISHABLE_KEY%",
      }),
    ).toEqual({});
  });

  it("throws the same error used by the sign-in and sign-up hooks when unconfigured", () => {
    expect(() => requireSupabaseAuth(null)).toThrow("Supabase Auth is not configured");
  });
});
