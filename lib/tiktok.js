// TikTok Content Posting API client (Direct Post, FILE_UPLOAD).
// Docs: developers.tiktok.com/doc/content-posting-api-reference-direct-post

const API = "https://open.tiktokapis.com/v2";
export const TIKTOK_SCOPES = "user.info.basic,video.publish";
const MIN_CHUNK = 5 * 1024 * 1024;
const MAX_CHUNK = 64 * 1024 * 1024;
const DEFAULT_CHUNK = 10 * 1024 * 1024;

export function authorizeUrl({ clientKey, redirectUri, state }) {
  const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
  url.searchParams.set("client_key", clientKey);
  url.searchParams.set("scope", TIKTOK_SCOPES);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

async function tokenRequest(form, fetchImpl = fetch) {
  const response = await fetchImpl(`${API}/oauth/token/`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "cache-control": "no-cache" },
    body: new URLSearchParams(form).toString(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error || !data.access_token) {
    throw new Error(`TikTok token request failed: ${data.error_description || data.error || response.statusText}`);
  }
  return data;
}

export function exchangeCode({ clientKey, clientSecret, code, redirectUri }, fetchImpl) {
  return tokenRequest({ client_key: clientKey, client_secret: clientSecret, code, grant_type: "authorization_code", redirect_uri: redirectUri }, fetchImpl);
}

export function refreshAccessToken({ clientKey, clientSecret, refreshToken }, fetchImpl) {
  return tokenRequest({ client_key: clientKey, client_secret: clientSecret, grant_type: "refresh_token", refresh_token: refreshToken }, fetchImpl);
}

async function apiPost(path, accessToken, body, fetchImpl = fetch) {
  const response = await fetchImpl(`${API}${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json; charset=UTF-8" },
    body: JSON.stringify(body || {}),
  });
  const data = await response.json().catch(() => ({}));
  const code = data?.error?.code;
  if (!response.ok || (code && code !== "ok")) {
    throw new Error(`TikTok ${path} failed: ${code || response.status} ${data?.error?.message || ""}`.trim());
  }
  return data.data || {};
}

export function queryCreatorInfo(accessToken, fetchImpl) {
  return apiPost("/post/publish/creator_info/query/", accessToken, {}, fetchImpl);
}

// Chunk plan per TikTok media transfer rules: files up to 64 MB go in one
// chunk; larger files use 10 MB chunks with the remainder merged into the last.
export function chunkPlan(size) {
  if (!Number.isFinite(size) || size <= 0) throw new Error("Video size must be positive");
  if (size <= MAX_CHUNK) return { chunkSize: size, totalChunkCount: 1 };
  const chunkSize = Math.max(MIN_CHUNK, DEFAULT_CHUNK);
  return { chunkSize, totalChunkCount: Math.floor(size / chunkSize) };
}

export function choosePrivacy(options, preferred) {
  const list = Array.isArray(options) ? options : [];
  if (preferred && list.includes(preferred)) return preferred;
  if (list.includes("PUBLIC_TO_EVERYONE")) return "PUBLIC_TO_EVERYONE";
  return list[0] || "SELF_ONLY";
}

export async function directPostVideo({ accessToken, video, title, privacyLevel, fetchImpl = fetch, log = () => {} }) {
  const size = video.byteLength;
  const { chunkSize, totalChunkCount } = chunkPlan(size);
  const init = await apiPost("/post/publish/video/init/", accessToken, {
    post_info: {
      title: String(title || "").slice(0, 2200),
      privacy_level: privacyLevel,
      disable_duet: false,
      disable_comment: false,
      disable_stitch: false,
      video_cover_timestamp_ms: 1000,
    },
    source_info: { source: "FILE_UPLOAD", video_size: size, chunk_size: chunkSize, total_chunk_count: totalChunkCount },
  }, fetchImpl);
  if (!init.publish_id || !init.upload_url) throw new Error("TikTok init returned no upload URL");
  log(`TikTok publish ${init.publish_id}: uploading ${size} bytes in ${totalChunkCount} chunk(s)`);

  for (let index = 0; index < totalChunkCount; index += 1) {
    const start = index * chunkSize;
    const end = index === totalChunkCount - 1 ? size - 1 : start + chunkSize - 1;
    const chunk = video.subarray(start, end + 1);
    const response = await fetchImpl(init.upload_url, {
      method: "PUT",
      headers: {
        "content-type": "video/mp4",
        "content-length": String(chunk.byteLength),
        "content-range": `bytes ${start}-${end}/${size}`,
      },
      body: chunk,
    });
    if (![200, 201, 206].includes(response.status)) {
      throw new Error(`TikTok chunk ${index + 1}/${totalChunkCount} upload failed: HTTP ${response.status}`);
    }
  }
  return init.publish_id;
}

export async function waitForPublish(accessToken, publishId, { fetchImpl = fetch, attempts = 24, intervalMs = 5000, log = () => {} } = {}) {
  let last = {};
  for (let i = 0; i < attempts; i += 1) {
    last = await apiPost("/post/publish/status/fetch/", accessToken, { publish_id: publishId }, fetchImpl);
    log(`TikTok status: ${last.status}`);
    if (["PUBLISH_COMPLETE", "FAILED", "SEND_TO_USER_INBOX"].includes(last.status)) return last;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return last;
}
