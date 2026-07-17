import { createHash, createHmac, randomBytes } from "node:crypto";

const STORE_URL = "https://njjdxatbxwojupwgkiai.supabase.co/functions/v1/gemassist-growth";
const PUBLISHABLE_KEY = "sb_publishable_flNVJKA9OSOSQLheVeQpig_kr-1jmt-";

function signingKey() {
  const token = process.env.BOT_TOKEN || "";
  if (!token) return null;
  return createHash("sha256").update(`gemassist-growth-v1:${token}`).digest();
}

async function callStore(body, signature = "") {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(STORE_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: PUBLISHABLE_KEY,
        authorization: `Bearer ${PUBLISHABLE_KEY}`,
        ...(signature ? { "x-gemassist-signature": signature } : {}),
      },
      body,
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `Growth store request failed with HTTP ${response.status}`);
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

export function isGrowthStoreConfigured() {
  return Boolean(process.env.BOT_TOKEN);
}

export async function growthStoreStatus() {
  try {
    const data = await callStore(JSON.stringify({ action: "status" }));
    return { configured: true, ok: true, ...data };
  } catch (error) {
    return { configured: true, ok: false, ready: false, error: error.name === "AbortError" ? "Growth store status timed out" : error.message };
  }
}

export async function growthStore(action, payload = {}) {
  const key = signingKey();
  if (!key) return { ok: false, configured: false, error: "BOT_TOKEN is not configured" };

  const request = {
    action,
    timestamp: Date.now(),
    nonce: randomBytes(24).toString("base64url"),
    ...payload,
  };
  const body = JSON.stringify(request);
  const signature = createHmac("sha256", key).update(body).digest("hex");

  try {
    const data = await callStore(body, signature);
    return { configured: true, ok: true, ...data };
  } catch (error) {
    return { ok: false, configured: true, error: error.name === "AbortError" ? "Growth store request timed out" : error.message };
  }
}

export function referralCodeFor(userId) {
  const value = String(userId || "").replace(/[^0-9]/g, "");
  if (!value) return "";
  return Number(value).toString(36).slice(-10);
}
