import {
  createPublicKey,
  timingSafeEqual,
  verify as cryptoVerify,
} from "node:crypto";

const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
export const SCHEDULER_PUBLIC_KEY_HEX = "6a9c2af555c95d0154030d5d911e383bd57e3b450d3bbbbd86f384d63bf3824f";
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const AUTOMATION_PATH = "/api/automation";

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && timingSafeEqual(a, b);
}

function publicKey(keyHex) {
  if (!/^[a-f0-9]{64}$/i.test(String(keyHex || ""))) {
    throw new Error("Invalid scheduler public key");
  }
  return createPublicKey({
    key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(keyHex, "hex")]),
    format: "der",
    type: "spki",
  });
}

export function schedulerMessage(timestamp, nonce, path = AUTOMATION_PATH) {
  return `GET\n${path}\n${timestamp}\n${nonce}`;
}

export function verifySchedulerHeaders(headers = {}, options = {}) {
  const timestamp = String(headers["x-gemassist-scheduler-timestamp"] || "");
  const nonce = String(headers["x-gemassist-scheduler-nonce"] || "");
  const signature = String(headers["x-gemassist-scheduler-signature"] || "");
  const now = Number(options.now ?? Date.now());
  const keyHex = options.publicKeyHex || SCHEDULER_PUBLIC_KEY_HEX;
  const path = options.path || AUTOMATION_PATH;

  if (!/^\d{13}$/.test(timestamp)) return false;
  if (!/^[a-f0-9]{36}$/i.test(nonce)) return false;
  if (!/^[a-f0-9]{128}$/i.test(signature)) return false;
  if (!Number.isFinite(now) || Math.abs(now - Number(timestamp)) > MAX_CLOCK_SKEW_MS) return false;

  try {
    const verified = cryptoVerify(
      null,
      Buffer.from(schedulerMessage(timestamp, nonce, path)),
      publicKey(keyHex),
      Buffer.from(signature, "hex"),
    );
    return safeEqual(verified ? "1" : "0", "1");
  } catch {
    return false;
  }
}
