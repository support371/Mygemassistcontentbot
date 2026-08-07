import { randomBytes } from "node:crypto";
import { signGrowthPayload } from "./growth-signing.js";
import {
  SUPABASE_GROWTH_PUBLISHABLE_KEY,
  SUPABASE_GROWTH_RPC_BASE,
} from "./supabase-growth-config.js";

const GATEWAY_URL = `${SUPABASE_GROWTH_RPC_BASE}/gemassist_gateway`;
const STATUS_URL = `${SUPABASE_GROWTH_RPC_BASE}/gemassist_status`;
const CHANNEL_SNAPSHOT_URL = `${SUPABASE_GROWTH_RPC_BASE}/gemassist_channel_snapshot_gateway`;

async function callRpc(url, payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: SUPABASE_GROWTH_PUBLISHABLE_KEY,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
      throw new Error(data.message || data.error || `Growth store request failed with HTTP ${response.status}`);
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
    const data = await callRpc(STATUS_URL, {});
    return { configured: true, ok: true, ...data };
  } catch (error) {
    return {
      configured: true,
      ok: false,
      ready: false,
      error: error.name === "AbortError" ? "Growth store status timed out" : error.message,
    };
  }
}

function signedRequest(payload = {}) {
  const request = {
    timestamp: Date.now(),
    nonce: randomBytes(24).toString("base64url"),
    ...payload,
  };
  const raw = JSON.stringify(request);
  return {
    p_raw: raw,
    p_signature: signGrowthPayload(raw),
  };
}

export async function growthStore(action, payload = {}) {
  if (!process.env.BOT_TOKEN) {
    return { ok: false, configured: false, error: "BOT_TOKEN is not configured" };
  }

  try {
    const data = await callRpc(GATEWAY_URL, signedRequest({ action, ...payload }));
    return { configured: true, ok: true, ...data };
  } catch (error) {
    return {
      ok: false,
      configured: true,
      error: error.name === "AbortError" ? "Growth store request timed out" : error.message,
    };
  }
}

export async function recordChannelMemberSnapshot(memberCount, measuredAt = new Date().toISOString()) {
  if (!process.env.BOT_TOKEN) {
    return { ok: false, configured: false, error: "BOT_TOKEN is not configured" };
  }

  try {
    const data = await callRpc(CHANNEL_SNAPSHOT_URL, signedRequest({
      member_count: Number(memberCount),
      measured_at: measuredAt,
    }));
    return { configured: true, ok: true, ...data };
  } catch (error) {
    return {
      ok: false,
      configured: true,
      error: error.name === "AbortError" ? "Channel snapshot request timed out" : error.message,
    };
  }
}

export function referralCodeFor(userId) {
  const value = String(userId || "").replace(/[^0-9]/g, "");
  if (!value) return "";
  return Number(value).toString(36).slice(-10);
}
