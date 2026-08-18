import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SKIP_DIRS = new Set([".git", ".vercel", "node_modules", "coverage", "dist", "build"]);
const TELEGRAM_TOKEN = /[0-9]{8,10}:AA[A-Za-z0-9_-]{30,}/g;
const TEXT_EXTENSIONS = new Set([
  ".cjs", ".css", ".html", ".js", ".json", ".jsx", ".md", ".mjs", ".sql", ".ts", ".tsx", ".txt", ".yml", ".yaml",
]);

function fail(message) {
  console.error(`RELEASE_GATE_FAIL: ${message}`);
  process.exitCode = 1;
}

async function readJson(relativePath) {
  const raw = await fs.readFile(path.join(ROOT, relativePath), "utf8");
  return JSON.parse(raw);
}

async function validateVercelConfig() {
  const config = await readJson("vercel.json");
  const routes = Array.isArray(config.routes) ? config.routes : [];
  const crons = Array.isArray(config.crons) ? config.crons : [];

  const requiredRoutes = new Map([
    ["/api/webhook", "/api/webhook.js"],
    ["/api/webhook-health", "/api/webhook-health.js"],
    ["/api/automation", "/api/automation-entry.js"],
    ["/api/growth-status", "/api/growth-status.js"],
    ["/api/channel-members", "/api/channel-members.js"],
    ["/api/telegram-intelligence", "/api/telegram-intelligence.js"],
    ["/api/telegram-discovery", "/api/telegram-discovery.js"],
    ["/guide.pdf", "/api/guide.js"],
  ]);

  for (const [src, dest] of requiredRoutes) {
    const match = routes.find((route) => route?.src === src);
    if (!match || match.dest !== dest) {
      fail(`vercel.json must route ${src} to ${dest}`);
    }
  }

  const cron = crons.find((entry) => entry?.path === "/api/automation");
  if (!cron || cron.schedule !== "0 14 * * *") {
    fail("vercel.json must keep /api/automation scheduled at 0 14 * * *");
  }

  const apiHeaderRule = (config.headers || []).find((rule) => rule?.source === "/api/(.*)");
  const noStore = apiHeaderRule?.headers?.some(
    (header) => String(header?.key || "").toLowerCase() === "cache-control" && String(header?.value || "").toLowerCase().includes("no-store"),
  );
  if (!noStore) fail("API routes must retain Cache-Control: no-store");
}

async function collectTextFiles(dir, output = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectTextFiles(absolute, output);
      continue;
    }
    if (!entry.isFile()) continue;
    const extension = path.extname(entry.name).toLowerCase();
    if (TEXT_EXTENSIONS.has(extension) || entry.name === ".env.example") output.push(absolute);
  }
  return output;
}

async function detectCommittedTelegramTokens() {
  const files = await collectTextFiles(ROOT);
  const findings = [];
  for (const absolute of files) {
    const relative = path.relative(ROOT, absolute).replaceAll(path.sep, "/");
    const content = await fs.readFile(absolute, "utf8").catch(() => "");
    TELEGRAM_TOKEN.lastIndex = 0;
    if (TELEGRAM_TOKEN.test(content)) findings.push(relative);
  }
  if (findings.length) {
    fail(`potential Telegram bot token detected in tracked source files: ${findings.join(", ")}`);
  }
}

async function validatePackageContract() {
  const pkg = await readJson("package.json");
  if (pkg?.scripts?.vercelBuild) {
    fail("use the standard vercel-build script key, not vercelBuild");
  }
  if (pkg?.engines?.node !== ">=20") {
    fail("package.json must retain Node >=20 runtime contract");
  }
}

await validateVercelConfig();
await detectCommittedTelegramTokens();
await validatePackageContract();

if (process.exitCode) process.exit(process.exitCode);
console.log("RELEASE_GATE_PASS: Vercel config, route invariants, cron schedule, API cache policy, runtime contract, and Telegram token scan passed.");
