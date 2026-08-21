import "dotenv/config";
import { createServer } from "http";
import net from "net";
import type { Application } from "express";
import { createApiApp } from "./api";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

/**
 * Build the API application without starting a long-lived listener. Vercel's
 * function imports this with serveClient=false, so it only mounts tRPC.
 */
export async function createApp(
  options: { serveClient?: boolean; devServer?: ReturnType<typeof createServer> } = {},
): Promise<Application> {
  const app = createApiApp();
  const serveClient = options.serveClient ?? true;

  if (serveClient) {
    if (process.env.NODE_ENV === "development") {
      const { setupVite } = await import("./vite");
      await setupVite(app, options.devServer ?? createServer(app));
    } else {
      const { serveStatic } = await import("./vite");
      serveStatic(app);
    }
  }

  return app;
}

async function startServer() {
  const server = createServer();
  const app = await createApp({ serveClient: true, devServer: server });
  server.on("request", app);
  const preferredPort = parseInt(process.env.PORT || "3000", 10);
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port}`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

if (!process.env.VERCEL && process.env.NODE_ENV !== "test") {
  startServer().catch(console.error);
}
