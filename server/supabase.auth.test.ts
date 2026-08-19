import { describe, expect, it } from "vitest";

describe("Supabase Auth configuration", () => {
  it("accepts the configured public key at the Auth settings endpoint", async () => {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    expect(supabaseUrl).toMatch(/^https:\/\/[a-z0-9-]+\.supabase\.co$/);
    expect(publishableKey).toMatch(/^sb_publishable_/);

    const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: {
        apikey: publishableKey!,
        Authorization: `Bearer ${publishableKey}`,
      },
    });

    expect(response.ok).toBe(true);
    const settings = (await response.json()) as { external?: Record<string, boolean> };
    expect(settings).toHaveProperty("external");
  }, 15_000);
});
