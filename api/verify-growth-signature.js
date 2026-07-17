import { createHash, createHmac, timingSafeEqual } from "node:crypto";

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && timingSafeEqual(a, b);
}

export default function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const token = process.env.BOT_TOKEN || "";
  const payload = String(req.body?.payload || "");
  const signature = String(req.body?.signature || "");
  if (!token || !payload || !/^[a-f0-9]{64}$/i.test(signature)) {
    return res.status(401).json({ ok: false });
  }

  let decoded;
  try {
    decoded = JSON.parse(payload);
  } catch {
    return res.status(401).json({ ok: false });
  }

  const timestamp = Number(decoded.timestamp || 0);
  if (!timestamp || Math.abs(Date.now() - timestamp) > 5 * 60 * 1000) {
    return res.status(401).json({ ok: false });
  }

  const key = createHash("sha256").update(`gemassist-growth-v1:${token}`).digest();
  const expected = createHmac("sha256", key).update(payload).digest("hex");
  if (!safeEqual(signature, expected)) return res.status(401).json({ ok: false });

  return res.status(200).json({ ok: true });
}
