import test from "node:test";
import assert from "node:assert/strict";

process.env.BOT_TOKEN = "123:test";
process.env.WEBHOOK_SECRET = "secret";
process.env.BOT_USERNAME = "Gemassistbuilder_Bot";
process.env.CF_ACCOUNT_ID = "acct";
process.env.CF_AI_TOKEN = "cf";

const { default: handler, AI_NOTICE } = await import("../api/webhook.js");

function update(text) {
  return {
    method: "POST",
    headers: { "x-telegram-bot-api-secret-token": "secret" },
    body: { message: { chat: { id: 7, type: "private" }, from: { id: 7, first_name: "Gem" }, text } },
  };
}

function response() {
  return { statusCode: 0, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; }, setHeader() {} };
}

async function run(text, aiText = "Call your title company on a number you found yourself.") {
  const sent = [];
  let aiCalls = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("api.cloudflare.com")) {
      aiCalls += 1;
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: aiText } }] }) };
    }
    const body = JSON.parse(init?.body || "{}");
    if (String(url).endsWith("/sendMessage")) sent.push(body.text);
    return { ok: true, status: 200, json: async () => ({ ok: true, result: {} }) };
  };
  try {
    const res = response();
    await handler(update(text), res);
    return { res, sent, aiCalls };
  } finally {
    globalThis.fetch = original;
  }
}

test("/ask reaches the AI even when the question contains a keyword shortcut", async () => {
  const { res, sent, aiCalls } = await run("/ask how do I avoid real estate wire fraud?");
  assert.equal(res.statusCode, 200);
  assert.equal(aiCalls, 1);
  assert.equal(sent.length, 1);
  assert.match(sent[0], /title company/);
  assert.doesNotMatch(sent[0], /Real Estate Fraud Alerts/);
});

test("AI replies carry the external-processing notice", async () => {
  const { sent } = await run("/ask is SMS 2FA enough?");
  assert.ok(sent[0].includes(AI_NOTICE));
});

test("keyword shortcuts still answer plain messages without calling the AI", async () => {
  const { sent, aiCalls } = await run("real estate");
  assert.equal(aiCalls, 0);
  assert.match(sent[0], /Real Estate Fraud Alerts/);
});
