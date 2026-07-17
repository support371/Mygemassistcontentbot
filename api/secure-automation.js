import { timingSafeEqual } from "node:crypto";
import automationHandler from "./automation.js";

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && timingSafeEqual(a, b);
}

function bearerToken(req) {
  return String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const bearer = bearerToken(req);
  const cronSecret = process.env.CRON_SECRET || "";
  const setupKey = process.env.SETUP_KEY || "";
  const isCron = Boolean(cronSecret) && safeEqual(bearer, cronSecret);
  const isManualAdmin = Boolean(setupKey) && safeEqual(bearer, setupKey);

  if (!isCron && !isManualAdmin) {
    const scheduledRequest = Boolean(req.headers["x-vercel-cron-schedule"]);
    if (scheduledRequest && !cronSecret) {
      return res.status(503).json({
        ok: false,
        error: "CRON_SECRET is required before scheduled publishing can run",
        code: "CRON_SECRET_MISSING",
      });
    }
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  return automationHandler(req, res);
}
