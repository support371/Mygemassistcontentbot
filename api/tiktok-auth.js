import { createHmac, timingSafeEqual } from "node:crypto";
import { authorizeUrl, exchangeCode } from "../lib/tiktok.js";

// One-time owner flow that connects the GEM Enterprise TikTok app:
//   1. Open /api/tiktok-auth?key=<SETUP_KEY> and sign in to TikTok.
//   2. TikTok returns here; the page shows the refresh token once.
//   3. Save it as the TIKTOK_REFRESH_TOKEN GitHub Actions secret.
// Register <PUBLIC_BASE_URL>/api/tiktok-auth as a redirect URI in the app.

const STATE_TTL_MS = 15 * 60 * 1000;

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && timingSafeEqual(a, b);
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function sign(timestamp, secret) {
  return createHmac("sha256", secret).update(`tiktok-auth:${timestamp}`).digest("hex");
}

export function makeState(secret, now = Date.now()) {
  return `${now}.${sign(now, secret)}`;
}

export function verifyState(state, secret, now = Date.now()) {
  const [timestamp, signature] = String(state || "").split(".");
  if (!/^\d{13}$/.test(timestamp || "") || !signature) return false;
  if (now - Number(timestamp) > STATE_TTL_MS || Number(timestamp) - now > 60000) return false;
  return safeEqual(signature, sign(timestamp, secret));
}

function page(res, status, title, bodyHtml) {
  res.statusCode = status;
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.setHeader("x-robots-tag", "noindex");
  res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>
<style>body{font:15px/1.5 system-ui,sans-serif;background:#0a0c0f;color:#e7ebef;max-width:640px;margin:40px auto;padding:0 16px}code{display:block;word-break:break-all;background:#171c21;border:1px solid #2a323b;padding:12px;border-radius:8px;user-select:all}h1{font-size:20px}.muted{color:#8a96a3}</style>
<h1>${escapeHtml(title)}</h1>${bodyHtml}`);
}

function config(req) {
  const base = (process.env.PUBLIC_BASE_URL || `https://${req.headers["x-forwarded-host"] || req.headers.host}`).replace(/\/$/, "");
  return {
    clientKey: process.env.TIKTOK_CLIENT_KEY || "",
    clientSecret: process.env.TIKTOK_CLIENT_SECRET || "",
    setupKey: process.env.SETUP_KEY || "",
    redirectUri: process.env.TIKTOK_REDIRECT_URI || `${base}/api/tiktok-auth`,
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.statusCode = 405;
    return res.end("Method not allowed");
  }
  const cfg = config(req);
  if (!cfg.clientKey || !cfg.clientSecret || !cfg.setupKey) {
    return page(res, 503, "TikTok connection is not configured", "<p>Set TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET and SETUP_KEY in the Vercel project, then reload.</p>");
  }

  const url = new URL(req.url || "/", "https://gemassist.invalid");
  const params = url.searchParams;

  if (params.get("error")) {
    return page(res, 400, "TikTok sign-in was cancelled", `<p class="muted">${escapeHtml(params.get("error_description") || params.get("error"))}</p>`);
  }

  if (params.get("code")) {
    if (!verifyState(params.get("state"), cfg.setupKey)) {
      return page(res, 401, "This sign-in link expired", "<p>Start again from /api/tiktok-auth with your setup key.</p>");
    }
    try {
      const token = await exchangeCode({ clientKey: cfg.clientKey, clientSecret: cfg.clientSecret, code: params.get("code"), redirectUri: cfg.redirectUri });
      const days = Math.round(Number(token.refresh_expires_in || 0) / 86400);
      return page(res, 200, "TikTok connected", `<p>Copy this refresh token into the GitHub repository secret <b>TIKTOK_REFRESH_TOKEN</b> (Settings → Secrets and variables → Actions). It is shown only on this page.</p>
<code>${escapeHtml(token.refresh_token)}</code>
<p class="muted">Scopes: ${escapeHtml(token.scope || "")}. Valid for about ${days} days; repeat this sign-in before it expires.</p>`);
    } catch (error) {
      return page(res, 502, "TikTok did not return a token", `<p class="muted">${escapeHtml(error.message)}</p>`);
    }
  }

  if (!safeEqual(params.get("key"), cfg.setupKey)) {
    return page(res, 401, "Setup key required", "<p>Open this page as /api/tiktok-auth?key=YOUR_SETUP_KEY.</p>");
  }
  res.statusCode = 302;
  res.setHeader("cache-control", "no-store");
  res.setHeader("location", authorizeUrl({ clientKey: cfg.clientKey, redirectUri: cfg.redirectUri, state: makeState(cfg.setupKey) }));
  return res.end();
}
