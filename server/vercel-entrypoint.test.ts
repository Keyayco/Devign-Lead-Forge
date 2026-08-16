import { describe, expect, it } from "vitest";
import { createApp } from "./_core/index";

describe("Vercel API entrypoint", () => {
  it("builds an Express app without attaching the local server listener", async () => {
    const app = await createApp({ serveClient: false });
    expect(typeof app).toBe("function");
  });
});
