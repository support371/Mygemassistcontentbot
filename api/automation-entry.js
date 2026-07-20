import automationHandler from "./automation.js";
import { growthStore, isGrowthStoreConfigured } from "../lib/growth-store.js";

function parseQuery(requestUrl) {
  try {
    const url = new URL(String(requestUrl || "/"), "https://gemassist.invalid");
    return Object.fromEntries(url.searchParams.entries());
  } catch {
    return {};
  }
}

function runIdentity(req) {
  const cronSchedule = String(req.headers["x-vercel-cron-schedule"] || "");
  const userAgent = String(req.headers["user-agent"] || "").toLowerCase();
  const hasBearer = /^Bearer\s+\S+/i.test(String(req.headers.authorization || ""));
  const firstRun = String(req.query?.first_run || "") === "1";
  const cronRequest = Boolean(cronSchedule || userAgent.includes("vercel-cron"));
  const source = cronRequest ? "vercel-cron" : "automation-entry";
  const requestId = String(req.headers["x-vercel-id"] || req.headers["x-request-id"] || Date.now());
  return {
    source,
    track: req.method === "GET" && (cronRequest || hasBearer || firstRun),
    runKey: `automation:${source}:${requestId}`.slice(0, 80),
  };
}

async function completeRun(runKey, status, detail) {
  if (!runKey || !isGrowthStoreConfigured()) return;
  const result = await growthStore("complete_automation_run", {
    run_key: runKey,
    status,
    detail,
  });
  if (!result.ok) console.error("Automation run completion was not recorded", result.error);
}

export default async function handler(req, res) {
  Object.defineProperty(req, "query", {
    configurable: true,
    enumerable: true,
    writable: false,
    value: parseQuery(req.url),
  });

  const identity = runIdentity(req);
  let runKey = "";
  if (identity.track && isGrowthStoreConfigured()) {
    const claim = await growthStore("claim_automation_run", {
      run_key: identity.runKey,
      source: identity.source,
    });
    if (claim.ok && claim.claimed) runKey = identity.runKey;
    else if (!claim.ok) console.error("Automation run claim was not recorded", claim.error);
  }

  try {
    const result = await automationHandler(req, res);
    const httpStatus = Number(res.statusCode || 200);
    await completeRun(runKey, httpStatus >= 200 && httpStatus < 300 ? "completed" : "partial", {
      http_status: httpStatus,
      source: identity.source,
    });
    return result;
  } catch (error) {
    await completeRun(runKey, "failed", {
      http_status: Number(res.statusCode || 500),
      source: identity.source,
      error: String(error?.message || error).slice(0, 500),
    });
    throw error;
  }
}
