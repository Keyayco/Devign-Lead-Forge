import express, { type Application } from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers.js";
import { createContext } from "./context.js";

/**
 * Build only the request-handling portion of the application.
 *
 * Vercel imports this module directly, so the production function never
 * initializes Vite middleware, static serving, or a local HTTP listener.
 */
export function createApiApp(): Application {
  const app = express();

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  return app;
}
