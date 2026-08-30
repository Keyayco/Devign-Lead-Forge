import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createApiApp } from "../../server/_core/api";

let appPromise: Promise<ReturnType<typeof createApiApp>> | undefined;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  appPromise ??= Promise.resolve(createApiApp());
  const app = await appPromise;
  return new Promise<void>((resolve, reject) => {
    res.once("finish", () => resolve());
    res.once("close", () => resolve());
    res.once("error", err => reject(err));
    try {
      app(req as never, res as never);
    } catch (error) {
      reject(error);
    }
  });
}
