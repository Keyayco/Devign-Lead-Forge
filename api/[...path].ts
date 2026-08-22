import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createApiApp } from "../server/_core/api";

let appPromise: Promise<ReturnType<typeof createApiApp>> | undefined;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  appPromise ??= Promise.resolve(createApiApp());
  const app = await appPromise;
  return app(req as never, res as never);
}
