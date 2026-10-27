// GemAssist TikTok autopost pipeline (runs in GitHub Actions).
//
// 1. Plan: an open-weight model (gpt-oss via lib/llm.js) writes the hook,
//    voiceover, footage searches and caption. Without AI keys a built-in plan
//    for the vertical is used, so the pipeline never depends on one provider.
// 2. Footage: real-person stock clips from the Pexels API (free key).
// 3. Voice: Piper text-to-speech (open-source), espeak-ng as a fallback.
// 4. Edit: ffmpeg renders a 1080x1920 H.264 video with the hook on screen.
// 5. Post: TikTok Content Posting API, Direct Post, FILE_UPLOAD.
// DRY_RUN=true (the default) builds the video and skips posting.

import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { completeJson, isAiConfigured } from "../../lib/llm.js";
import { choosePrivacy, directPostVideo, queryCreatorInfo, refreshAccessToken, waitForPublish } from "../../lib/tiktok.js";

const FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";
const CLIP_COUNT = 3;

export const VERTICALS = [
  {
    key: "cybersecurity",
    brief: "a practical cybersecurity habit for small businesses and families",
    terms: ["person typing on laptop", "office team computer", "smartphone notification"],
    plan: {
      hook: "Your password isn't the problem",
      voiceover: "Most account takeovers start with one reused password. Here's the fix that takes five minutes. Turn on an authenticator app for your email first, because email resets everything else. Then your bank, then your cloud storage. Skip text message codes where you can. One email account protected properly closes the door attackers use most. Follow GEM Enterprise for one security habit a day.",
      caption: "The 5-minute fix that stops most account takeovers.",
      hashtags: ["cybersecurity", "infosec", "smallbusiness", "securitytips", "gementerprise"],
    },
  },
  {
    key: "real-estate",
    brief: "a real-estate fraud prevention or smart property buying tip",
    terms: ["modern house exterior", "real estate agent client", "couple new home keys"],
    plan: {
      hook: "Never wire a deposit until you do this",
      voiceover: "Wire fraud is the fastest way to lose a house deposit. Scammers copy your agent's emails and send new payment instructions. Before you send a single dollar, call your title company on a number you found yourself, not one in the email, and confirm the account details out loud. If anything changed at the last minute, stop. Follow GEM Enterprise for smarter property moves.",
      caption: "One phone call that protects your house deposit.",
      hashtags: ["realestate", "homebuying", "wirefraud", "firsttimehomebuyer", "gementerprise"],
    },
  },
  {
    key: "finance",
    brief: "a personal finance safety or banking and crypto scam awareness tip",
    terms: ["mobile banking phone", "credit card payment", "person checking finances"],
    plan: {
      hook: "Your bank will never ask you this",
      voiceover: "If someone calls saying they're your bank and asks you to move money to a safe account, hang up. Real banks never ask you to transfer funds to protect them. Call the number on the back of your card instead. The same goes for crypto: nobody legitimate needs your recovery phrase. Ever. Follow GEM Enterprise to keep your money where it belongs.",
      caption: "The safe account scam, and how to shut it down.",
      hashtags: ["finance", "scamawareness", "banking", "crypto", "gementerprise"],
    },
  },
  {
    key: "legal",
    brief: "a plain-language legal protection tip about contracts or identity",
    terms: ["signing contract", "business meeting documents", "person reading paperwork"],
    plan: {
      hook: "Read this line before you sign anything",
      voiceover: "Before you sign a contract, find three things. How you can get out of it, what happens if a payment is late, and whether it renews automatically. Those three lines decide most disputes. If any of them is missing or unclear, ask for it in writing before you sign. A two-minute read now saves months later. Follow GEM Enterprise for practical protection.",
      caption: "Three contract lines that decide most disputes.",
      hashtags: ["legaltips", "contracts", "smallbusiness", "businessowner", "gementerprise"],
    },
  },
];

const log = (...args) => console.log("[autopost]", ...args);

export function pickVertical(date = new Date(), override = "") {
  const forced = VERTICALS.find((v) => v.key === String(override || "").trim().toLowerCase());
  if (forced) return forced;
  // Three daily runs (13:17, 17:47, 21:23 UTC) map to slots 0-2; the day
  // offset rotates which vertical leads each day.
  const day = Math.floor(date.getTime() / 86400000);
  const hour = date.getUTCHours();
  const slot = hour < 15 ? 0 : hour < 19 ? 1 : 2;
  return VERTICALS[(day * 3 + slot) % VERTICALS.length];
}

function words(text) {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length;
}

export function sanitizePlan(raw, vertical) {
  const base = vertical.plan;
  const pick = (value, fallback, max) => {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    return text ? text.slice(0, max) : fallback;
  };
  const voiceover = pick(raw?.voiceover, base.voiceover, 900);
  const terms = (Array.isArray(raw?.search_terms) ? raw.search_terms : [])
    .map((t) => String(t || "").replace(/[^\w\s-]/g, "").trim().slice(0, 40))
    .filter(Boolean);
  const hashtags = (Array.isArray(raw?.hashtags) ? raw.hashtags : base.hashtags)
    .map((t) => String(t || "").replace(/[^\w]/g, "").toLowerCase())
    .filter(Boolean)
    .slice(0, 6);
  if (!hashtags.includes("gementerprise")) hashtags.push("gementerprise");
  return {
    vertical: vertical.key,
    hook: pick(raw?.hook, base.hook, 60),
    voiceover: words(voiceover) >= 30 && words(voiceover) <= 140 ? voiceover : base.voiceover,
    searchTerms: [...new Set([...terms, ...vertical.terms])].slice(0, 6),
    caption: pick(raw?.caption, base.caption, 150),
    hashtags,
  };
}

async function planVideo(vertical, env) {
  if (!isAiConfigured(env)) return { plan: sanitizePlan(null, vertical), source: "built-in" };
  const result = await completeJson(
    [
      {
        role: "system",
        content: "You script 25-35 second TikTok videos for GEM Enterprise (cybersecurity, real estate, finance, legal). Tone: confident, practical, no hype, no false claims. Reply with only JSON: {\"hook\": string (max 50 chars, shown on screen in the first 3 seconds), \"voiceover\": string (60-85 spoken words, no hashtags or emojis, ends with \"Follow GEM Enterprise\" plus a short reason), \"search_terms\": [3 short stock-footage searches showing real people, suited to vertical video], \"caption\": string (max 140 chars), \"hashtags\": [4-6 tags without #]}.",
      },
      { role: "user", content: `Today's video: ${vertical.brief}. Make it specific and useful.` },
    ],
    { env, maxTokens: 700, temperature: 0.8, budgetMs: 45000 },
  );
  if (!result.ok) {
    log("AI plan unavailable, using built-in plan:", result.error);
    return { plan: sanitizePlan(null, vertical), source: "built-in" };
  }
  return { plan: sanitizePlan(result.data, vertical), source: `${result.provider}:${result.model}` };
}

async function findClips(terms, apiKey, count) {
  const used = new Set();
  const clips = [];
  for (const term of terms) {
    if (clips.length >= count) break;
    const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(term)}&orientation=portrait&size=medium&per_page=15`;
    const response = await fetch(url, { headers: { authorization: apiKey } });
    if (!response.ok) {
      log(`Pexels search "${term}" failed: HTTP ${response.status}`);
      continue;
    }
    const data = await response.json();
    for (const video of data.videos || []) {
      if (used.has(video.id)) continue;
      const file = (video.video_files || [])
        .filter((f) => f.file_type === "video/mp4" && f.width && f.height && f.height > f.width && f.height >= 1280 && f.height <= 2160)
        .sort((a, b) => Math.abs(a.height - 1920) - Math.abs(b.height - 1920))[0];
      if (!file) continue;
      used.add(video.id);
      clips.push({ id: video.id, term, url: file.link, page: video.url, author: video.user?.name || "" });
      break;
    }
  }
  return clips;
}

async function download(url, file) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed (${response.status}) for ${url}`);
  await fs.writeFile(file, Buffer.from(await response.arrayBuffer()));
}

function run(cmd, args, options = {}) {
  return execFileSync(cmd, args, { stdio: ["pipe", "pipe", "inherit"], maxBuffer: 64 * 1024 * 1024, ...options });
}

function synthesize(text, wavFile, env) {
  if (env.PIPER_MODEL) {
    try {
      run("piper", ["--model", env.PIPER_MODEL, "--output_file", wavFile], { input: text });
      return "piper";
    } catch (error) {
      log("Piper failed, falling back to espeak-ng:", error.message);
    }
  }
  run("espeak-ng", ["-v", "en-us", "-s", "158", "-w", wavFile, text]);
  return "espeak-ng";
}

function duration(file) {
  return Number(String(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file])).trim());
}

export function wrapHook(text, width = 18) {
  const lines = [];
  let line = "";
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    if ((line + " " + word).trim().length > width && line) {
      lines.push(line);
      line = word;
    } else {
      line = (line + " " + word).trim();
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 4).join("\n");
}

export function render({ clipFiles, voiceFile, hookFile, brandFile, outFile }) {
  const voice = duration(voiceFile);
  const total = voice + 0.8;
  const segment = (total / clipFiles.length + 0.05).toFixed(3);
  const args = ["-y"];
  for (const file of clipFiles) args.push("-stream_loop", "-1", "-t", segment, "-i", file);
  args.push("-i", voiceFile);
  const scaled = clipFiles.map((_, i) => `[${i}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,setsar=1,trim=duration=${segment},setpts=PTS-STARTPTS[v${i}]`);
  const concat = `${clipFiles.map((_, i) => `[v${i}]`).join("")}concat=n=${clipFiles.length}:v=1:a=0[base]`;
  const hook = `[base]drawtext=fontfile=${FONT}:textfile=${hookFile}:fontcolor=white:fontsize=66:line_spacing=14:box=1:boxcolor=black@0.6:boxborderw=28:x=(w-text_w)/2:y=h*0.17:enable='lt(t,3.6)'[hooked]`;
  const brand = `[hooked]drawtext=fontfile=${FONT}:textfile=${brandFile}:fontcolor=white@0.85:fontsize=34:x=(w-text_w)/2:y=h-150[v]`;
  args.push(
    "-filter_complex", [...scaled, concat, hook, brand].join(";"),
    "-map", "[v]", "-map", `${clipFiles.length}:a`,
    "-t", total.toFixed(2),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-r", "30",
    "-c:a", "aac", "-b:a", "160k", "-ar", "44100",
    "-movflags", "+faststart",
    outFile,
  );
  run("ffmpeg", args);
  return { seconds: Number(total.toFixed(2)) };
}

async function post(videoFile, plan, env, seconds) {
  const accessTokenResponse = await refreshAccessToken({
    clientKey: env.TIKTOK_CLIENT_KEY,
    clientSecret: env.TIKTOK_CLIENT_SECRET,
    refreshToken: env.TIKTOK_REFRESH_TOKEN,
  });
  const accessToken = accessTokenResponse.access_token;
  console.log(`::add-mask::${accessToken}`);
  if (accessTokenResponse.refresh_token && accessTokenResponse.refresh_token !== env.TIKTOK_REFRESH_TOKEN) {
    console.log(`::add-mask::${accessTokenResponse.refresh_token}`);
    log("TikTok issued a new refresh token. If posting later fails with an auth error, reconnect at /api/tiktok-auth.");
  }
  const creator = await queryCreatorInfo(accessToken);
  if (creator.max_video_post_duration_sec && seconds > creator.max_video_post_duration_sec) {
    throw new Error(`Video is ${seconds}s; this account allows ${creator.max_video_post_duration_sec}s`);
  }
  const privacyLevel = choosePrivacy(creator.privacy_level_options, env.TIKTOK_PRIVACY);
  const title = `${plan.caption} ${plan.hashtags.map((t) => `#${t}`).join(" ")}`.trim();
  const video = await fs.readFile(videoFile);
  const publishId = await directPostVideo({ accessToken, video, title, privacyLevel, log });
  const status = await waitForPublish(accessToken, publishId, { log });
  return { publishId, privacyLevel, status: status.status || "UNKNOWN", failReason: status.fail_reason || "", account: creator.creator_username || "" };
}

async function summary(result) {
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  const lines = [
    `### TikTok autopost: ${result.outcome}`,
    "",
    `- Vertical: ${result.plan?.vertical || "-"}`,
    `- Plan source: ${result.planSource || "-"}`,
    `- Hook: ${result.plan?.hook || "-"}`,
    `- Caption: ${result.plan?.caption || "-"}`,
    `- Voice: ${result.voice || "-"}, length ${result.seconds || "-"}s`,
    `- Posting: ${result.posting ? `${result.posting.status} (${result.posting.privacyLevel})` : result.reason || "skipped"}`,
    "",
    ...(result.clips || []).map((c) => `- Footage: [${c.term}](${c.page}) by ${c.author || "Pexels contributor"}`),
  ];
  await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, `${lines.join("\n")}\n`);
}

export async function main(env = process.env) {
  const outDir = path.resolve(env.OUT_DIR || "tiktok-out");
  await fs.mkdir(outDir, { recursive: true });
  const dryRun = String(env.DRY_RUN ?? "true").toLowerCase() !== "false";
  const vertical = pickVertical(new Date(), env.TOPIC);
  const result = { outcome: "started", dryRun };

  try {
    const { plan, source } = await planVideo(vertical, env);
    Object.assign(result, { plan, planSource: source });
    log(`Plan (${source}) for ${vertical.key}: ${plan.hook}`);

    if (!env.PEXELS_API_KEY) {
      Object.assign(result, { outcome: "skipped", reason: "PEXELS_API_KEY is not set" });
      console.log("::warning::PEXELS_API_KEY is not set, so no footage could be fetched. Add the secret to enable video builds.");
      return result;
    }

    const clips = await findClips(plan.searchTerms, env.PEXELS_API_KEY, CLIP_COUNT);
    if (clips.length < 2) throw new Error(`Only ${clips.length} usable portrait clip(s) found`);
    result.clips = clips;
    const clipFiles = [];
    for (const [i, clip] of clips.entries()) {
      const file = path.join(outDir, `clip-${i}.mp4`);
      await download(clip.url, file);
      clipFiles.push(file);
    }

    const voiceFile = path.join(outDir, "voice.wav");
    result.voice = synthesize(plan.voiceover, voiceFile, env);
    const hookFile = path.join(outDir, "hook.txt");
    const brandFile = path.join(outDir, "brand.txt");
    await fs.writeFile(hookFile, wrapHook(plan.hook));
    await fs.writeFile(brandFile, env.BRAND_LINE || "GEM Enterprise");

    const videoFile = path.join(outDir, "video.mp4");
    const { seconds } = render({ clipFiles, voiceFile, hookFile, brandFile, outFile: videoFile });
    result.seconds = seconds;
    log(`Rendered ${videoFile} (${seconds}s)`);

    const hasTikTok = env.TIKTOK_CLIENT_KEY && env.TIKTOK_CLIENT_SECRET && env.TIKTOK_REFRESH_TOKEN;
    if (dryRun || !hasTikTok) {
      Object.assign(result, { outcome: "built", reason: dryRun ? "dry run" : "TikTok secrets are not set" });
      return result;
    }
    result.posting = await post(videoFile, plan, env, seconds);
    result.outcome = result.posting.status === "FAILED" ? "post failed" : "posted";
    if (result.posting.status === "FAILED") throw new Error(`TikTok rejected the post: ${result.posting.failReason}`);
    return result;
  } catch (error) {
    result.outcome = result.outcome === "post failed" ? result.outcome : "failed";
    result.error = String(error?.message || error);
    throw error;
  } finally {
    for (const name of ["clip-0.mp4", "clip-1.mp4", "clip-2.mp4"]) await fs.rm(path.join(outDir, name), { force: true });
    await fs.writeFile(path.join(outDir, "result.json"), JSON.stringify(result, null, 2));
    await summary(result).catch(() => {});
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(
    (result) => log(`Done: ${result.outcome}`),
    (error) => {
      console.error(`::error::${error.message}`);
      process.exit(1);
    },
  );
}
