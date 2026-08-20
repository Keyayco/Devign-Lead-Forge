import { describe, expect, it } from "vitest";
import postgres from "postgres";

describe("Supabase database configuration", () => {
  it("connects with the configured server-side PostgreSQL URI", async () => {
    const connectionString = process.env.SUPABASE_DATABASE_URL;
    expect(connectionString, "SUPABASE_DATABASE_URL must be configured").toBeTruthy();

    const sql = postgres(connectionString!, {
      prepare: false,
      max: 1,
      connect_timeout: 10,
    });

    try {
      const rows = await sql<{ ok: number }[]>`select 1 as ok`;
      expect(rows[0]?.ok).toBe(1);
    } finally {
      await sql.end({ timeout: 5 });
    }
  }, 20_000);
});
