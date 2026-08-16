import "dotenv/config";
import express, { type Express } from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

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
 * Build the API application without starting a long-lived listener. This is
 * what makes the same route surface usable by Vercel's Node function runtime.
 */
export async function createApp(
  options: { serveClient?: boolean; devServer?: ReturnType<typeof createServer> } = {},
): Promise<Express> {
  const app = express();
  const serveClient = options.serveClient ?? true;

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  if (serveClient) {
    if (process.env.NODE_ENV === "development") {
      await setupVite(app, options.devServer ?? createServer(app));
    } else {
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
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

// Vercel imports this module from api/[...path].ts; local development and
// the managed Manus runtime still use the standalone listener.
if (!process.env.VERCEL && process.env.NODE_ENV !== "test") {
  startServer().catch(console.error);
}
