import { createServer, type AddressInfo } from "node:http";
import { describe, expect, it } from "vitest";
import handler from "../api/trpc/[...path]";
import { createApp } from "./_core/index";

describe("Vercel API entrypoint", () => {
  it("builds the local app without attaching the listener itself", async () => {
    const app = await createApp({ serveClient: false });
    expect(typeof app).toBe("function");
  });

  it("forwards an unauthenticated tRPC request to the API and returns JSON", async () => {
    const server = createServer((req, res) => {
      void handler(req as never, res as never);
    });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address() as AddressInfo;

    try {
      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/trpc/leads.create?batch=1`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            0: {
              json: {
                name: "Probe",
                contact: "Agent",
                email: "probe@example.com",
                address: "1 Test St",
                type: "probe",
                demoLink: "https://example.com/demo",
              },
            },
          }),
        },
      );

      expect(response.status).toBe(401);
      expect(response.headers.get("content-type")).toContain("application/json");
      const responseBody = await response.text();
      expect(() => JSON.parse(responseBody)).not.toThrow();
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });
});
