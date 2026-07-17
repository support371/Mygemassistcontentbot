import { growthPublicKeyHex } from "../lib/growth-signing.js";

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    return res.status(200).json({
      ok: true,
      algorithm: "Ed25519",
      publicKey: growthPublicKeyHex(),
    });
  } catch (error) {
    return res.status(503).json({ ok: false, error: error.message });
  }
}
