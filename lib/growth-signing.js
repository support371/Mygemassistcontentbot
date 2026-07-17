import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign as cryptoSign,
} from "node:crypto";

const PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");

function privateKey() {
  const token = process.env.BOT_TOKEN || "";
  if (!token) throw new Error("BOT_TOKEN is not configured");
  const seed = createHash("sha256").update(`gemassist-ed25519-v1:${token}`).digest();
  return createPrivateKey({
    key: Buffer.concat([PKCS8_PREFIX, seed]),
    format: "der",
    type: "pkcs8",
  });
}

export function signGrowthPayload(payload) {
  return cryptoSign(null, Buffer.from(String(payload)), privateKey()).toString("hex");
}

export function growthPublicKeyHex() {
  const der = createPublicKey(privateKey()).export({ format: "der", type: "spki" });
  return Buffer.from(der).subarray(-32).toString("hex");
}
