const STORE_URL = process.env.GROWTH_STORE_URL || process.env.GOOGLE_APPS_SCRIPT_WEBHOOK || "";
const STORE_KEY = process.env.GROWTH_STORE_KEY || "";

export function isGrowthStoreConfigured() {
  return Boolean(STORE_URL);
}

export async function growthStore(action, payload = {}) {
  if (!STORE_URL) {
    return { ok: false, configured: false, error: "Growth store is not configured" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(STORE_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, key: STORE_KEY, ...payload }),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `Growth store request failed with HTTP ${response.status}`);
    }

    return { configured: true, ok: true, ...data };
  } catch (error) {
    return {
      ok: false,
      configured: true,
      error: error.name === "AbortError" ? "Growth store request timed out" : error.message,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function referralCodeFor(userId) {
  const value = String(userId || "").replace(/[^0-9]/g, "");
  if (!value) return "";
  return Number(value).toString(36).slice(-10);
}
