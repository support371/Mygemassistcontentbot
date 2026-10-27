import test from "node:test";
import assert from "node:assert/strict";
import { authorizeUrl, choosePrivacy, chunkPlan, directPostVideo } from "../lib/tiktok.js";
import { makeState, verifyState } from "../api/tiktok-auth.js";
import { generateChannelPost } from "../api/automation.js";
import { pickVertical, sanitizePlan, VERTICALS, wrapHook } from "../scripts/tiktok/autopost.mjs";

const MB = 1024 * 1024;

test("chunk plan follows TikTok media transfer rules", () => {
  assert.deepEqual(chunkPlan(3 * MB), { chunkSize: 3 * MB, totalChunkCount: 1 });
  assert.deepEqual(chunkPlan(64 * MB), { chunkSize: 64 * MB, totalChunkCount: 1 });
  assert.deepEqual(chunkPlan(95 * MB), { chunkSize: 10 * MB, totalChunkCount: 9 });
  assert.throws(() => chunkPlan(0));
});

test("privacy prefers the configured option, then public", () => {
  assert.equal(choosePrivacy(["SELF_ONLY", "PUBLIC_TO_EVERYONE"], ""), "PUBLIC_TO_EVERYONE");
  assert.equal(choosePrivacy(["SELF_ONLY", "PUBLIC_TO_EVERYONE"], "SELF_ONLY"), "SELF_ONLY");
  assert.equal(choosePrivacy(["SELF_ONLY"], "PUBLIC_TO_EVERYONE"), "SELF_ONLY");
  assert.equal(choosePrivacy(undefined), "SELF_ONLY");
});

test("authorize URL carries the posting scopes", () => {
  const url = new URL(authorizeUrl({ clientKey: "ck", redirectUri: "https://x.test/api/tiktok-auth", state: "s" }));
  assert.equal(url.searchParams.get("scope"), "user.info.basic,video.publish");
  assert.equal(url.searchParams.get("response_type"), "code");
});

test("sign-in state is signed and expires", () => {
  const now = Date.now();
  const state = makeState("setup-key", now);
  assert.equal(verifyState(state, "setup-key", now + 1000), true);
  assert.equal(verifyState(state, "other-key", now + 1000), false);
  assert.equal(verifyState(state, "setup-key", now + 16 * 60 * 1000), false);
  assert.equal(verifyState("garbage", "setup-key", now), false);
});

test("direct post sends init, one PUT with a full Content-Range", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith("/post/publish/video/init/")) {
      return { ok: true, status: 200, json: async () => ({ data: { publish_id: "p1", upload_url: "https://upload.test/u" }, error: { code: "ok" } }) };
    }
    return { ok: true, status: 201, json: async () => ({}) };
  };
  const video = Buffer.alloc(2048, 1);
  const id = await directPostVideo({ accessToken: "t", video, title: "Hi", privacyLevel: "SELF_ONLY", fetchImpl });
  assert.equal(id, "p1");
  const init = JSON.parse(calls[0].init.body);
  assert.deepEqual(init.source_info, { source: "FILE_UPLOAD", video_size: 2048, chunk_size: 2048, total_chunk_count: 1 });
  assert.equal(calls[1].init.method, "PUT");
  assert.equal(calls[1].init.headers["content-range"], "bytes 0-2047/2048");
});

test("video plans rotate verticals and repair weak AI output", () => {
  const keys = new Set([13, 17, 21].map((h) => pickVertical(new Date(Date.UTC(2026, 9, 27, h))).key));
  assert.equal(keys.size, 3);
  const nextDay = pickVertical(new Date(Date.UTC(2026, 9, 28, 13))).key;
  assert.notEqual(nextDay, pickVertical(new Date(Date.UTC(2026, 9, 27, 13))).key);
  assert.equal(pickVertical(new Date(), "legal").key, "legal");
  const plan = sanitizePlan({ hook: "", voiceover: "too short", hashtags: ["#Cyber Security!"] }, VERTICALS[0]);
  assert.equal(plan.hook, VERTICALS[0].plan.hook);
  assert.equal(plan.voiceover, VERTICALS[0].plan.voiceover);
  assert.ok(plan.hashtags.includes("cybersecurity") && plan.hashtags.includes("gementerprise"));
  assert.ok(plan.searchTerms.length >= 3);
  assert.equal(wrapHook("Never wire a deposit until you do this"), "Never wire a\ndeposit until you\ndo this");
});

test("channel post generation returns null without AI so the static post is used", async () => {
  const post = await generateChannelPost({ dateKey: "2026-10-27", title: "T", body: "B" }, { env: {} });
  assert.equal(post, null);
});

test("channel post generation uses the model reply", async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '{"title":"Lock down email first","body":"Email resets every other account, so protect it before anything else. Turn on an authenticator app today and remove old recovery numbers you no longer use."}' } }] }) });
  const post = await generateChannelPost({ dateKey: "2026-10-27", title: "T", body: "B" }, { env: { CF_ACCOUNT_ID: "a", CF_AI_TOKEN: "t" }, fetchImpl });
  assert.equal(post.title, "Lock down email first");
  assert.equal(post.provider, "cloudflare");
});
