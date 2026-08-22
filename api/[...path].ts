import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createServer } from "http";
import { createApiApp } from "../server/_core/api";

let appPromise: Promise<ReturnType<typeof createApiApp>> | undefined;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  appPromise ??= Promise.resolve(createApiApp());
  const app = await appPromise;
  return new Promise<void>((resolve, reject) => {
    const server = createServer(app);
    server.emit("request", req, res);
    res.on("finish", () => resolve());
    res.on("error", err => reject(err));
  });
}
