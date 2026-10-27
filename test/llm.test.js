import test from "node:test";
import assert from "node:assert/strict";
import { complete, completeJson, extractText, isAiConfigured, parseJsonReply, providerChain } from "../lib/llm.js";

const CF = { CF_ACCOUNT_ID: "acct", CF_AI_TOKEN: "cf-token" };

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, statusText: String(status), json: async () => body };
}

test("no credentials means no providers and a clean failure", async () => {
  assert.equal(isAiConfigured({}), false);
  const result = await complete([{ role: "user", content: "hi" }], { env: {}, fetchImpl: async () => { throw new Error("must not call"); } });
  assert.equal(result.ok, false);
});

test("provider order: Cloudflare 120b, Cloudflare 20b, OpenRouter, Hugging Face", () => {
  const chain = providerChain({ ...CF, OPENROUTER_API_KEY: "or", HF_TOKEN: "hf" });
  assert.deepEqual(chain.map((p) => `${p.name}:${p.model}`), [
    "cloudflare:@cf/openai/gpt-oss-120b",
    "cloudflare:@cf/openai/gpt-oss-20b",
    "openrouter:openai/gpt-oss-120b:free",
    "huggingface:openai/gpt-oss-120b",
  ]);
  assert.equal(providerChain(CF, { preferSmall: true })[0].model, "@cf/openai/gpt-oss-20b");
  assert.match(chain[0].url, /accounts\/acct\/ai\/v1\/chat\/completions$/);
});

test("falls through to the next provider when one is out of quota", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push(body.model);
    if (url.includes("cloudflare")) return jsonResponse(429, { errors: [{ message: "daily free allocation exceeded" }] });
    return jsonResponse(200, { choices: [{ message: { content: "Use an authenticator app." } }] });
  };
  const result = await complete([{ role: "user", content: "tip" }], { env: { ...CF, OPENROUTER_API_KEY: "or" }, fetchImpl });
  assert.equal(result.ok, true);
  assert.equal(result.provider, "openrouter");
  assert.equal(result.text, "Use an authenticator app.");
  assert.deepEqual(calls, ["@cf/openai/gpt-oss-120b", "@cf/openai/gpt-oss-20b", "openai/gpt-oss-120b:free"]);
  assert.equal(result.attempts[0].status, 429);
});

test("extractText reads chat, Workers AI and Responses shapes", () => {
  assert.equal(extractText({ choices: [{ message: { content: " a " } }] }), "a");
  assert.equal(extractText({ result: { response: "b" } }), "b");
  assert.equal(extractText({ output: [{ type: "reasoning", content: [{ text: "hidden" }] }, { type: "message", content: [{ type: "output_text", text: "c" }] }] }), "c");
  assert.equal(extractText({ choices: [{ message: { content: "<think>x</think>d" } }] }), "d");
  assert.equal(extractText(null), "");
});

test("parseJsonReply handles fences and surrounding text", () => {
  assert.deepEqual(parseJsonReply('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(parseJsonReply('Here you go: {"a":2} thanks'), { a: 2 });
  assert.equal(parseJsonReply("no json"), null);
});

test("completeJson reports invalid JSON as a failure", async () => {
  const fetchImpl = async () => jsonResponse(200, { choices: [{ message: { content: "not json" } }] });
  const result = await completeJson([{ role: "user", content: "x" }], { env: CF, fetchImpl });
  assert.equal(result.ok, false);
  assert.equal(result.data, null);
});
