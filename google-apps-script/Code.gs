const SHEETS = {
  Subscribers: [
    "chat_id", "user_id", "username", "first_name", "last_name", "consent_status",
    "referral_code", "referred_by", "source", "started_at", "subscribed_at",
    "unsubscribed_at", "verified_at", "last_seen_at", "followup_stage", "blocked_at"
  ],
  ContentQueue: [
    "id", "scheduled_at", "text_html", "button_text", "button_url", "status",
    "sent_at", "message_id", "error"
  ],
  DeliveryLog: ["timestamp", "type", "chat_id", "key", "status", "detail"],
  ChannelPosts: ["post_key", "queue_id", "sent_at", "message_id", "status", "error"],
  Referrals: ["timestamp", "referrer_code", "new_chat_id", "source"]
};

function doGet() {
  ensureWorkbook_();
  return json_({ ok: true, service: "GemAssist Growth Store", version: "1.0.0" });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    ensureWorkbook_();
    const payload = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    verifyKey_(payload.key || "");
    const action = String(payload.action || "");

    if (action === "upsert_subscriber") return json_(upsertSubscriber_(payload.subscriber || {}));
    if (action === "set_consent") return json_(setConsent_(payload));
    if (action === "get_subscriber") return json_(getSubscriber_(payload.chat_id));
    if (action === "mark_verified") return json_(markVerified_(payload));
    if (action === "record_referral") return json_(recordReferral_(payload));
    if (action === "list_due_followups") return json_(listDueFollowups_(payload));
    if (action === "mark_followup") return json_(markFollowup_(payload));
    if (action === "mark_blocked") return json_(markBlocked_(payload));
    if (action === "channel_post_exists") return json_(channelPostExists_(payload.post_key));
    if (action === "record_channel_post") return json_(recordChannelPost_(payload));
    if (action === "list_due_channel_posts") return json_(listDueChannelPosts_(payload));
    if (action === "analytics") return json_(analytics_());

    return json_({ ok: false, error: "Unknown action" });
  } catch (error) {
    return json_({ ok: false, error: error.message });
  } finally {
    lock.releaseLock();
  }
}

function verifyKey_(provided) {
  const required = PropertiesService.getScriptProperties().getProperty("GROWTH_STORE_KEY") || "";
  if (required && provided !== required) throw new Error("Unauthorized");
}

function workbook_() {
  const configuredId = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID") || "";
  if (configuredId) return SpreadsheetApp.openById(configuredId);
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) throw new Error("Bind this script to a Google Sheet or set SPREADSHEET_ID");
  return active;
}

function ensureWorkbook_() {
  const ss = workbook_();
  Object.keys(SHEETS).forEach(function(name) {
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    const headers = SHEETS[name];
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
    }
  });
}

function json_(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function sheet_(name) {
  return workbook_().getSheetByName(name);
}

function headerMap_(sheet) {
  const width = sheet.getLastColumn();
  const headers = width ? sheet.getRange(1, 1, 1, width).getValues()[0] : [];
  const map = {};
  headers.forEach(function(header, index) { map[String(header)] = index; });
  return map;
}

function rows_(sheet) {
  if (sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
}

function rowObject_(headers, row) {
  const result = {};
  Object.keys(headers).forEach(function(key) { result[key] = row[headers[key]]; });
  return result;
}

function findRow_(sheet, columnName, value) {
  const headers = headerMap_(sheet);
  const column = headers[columnName];
  if (column === undefined) return 0;
  const data = rows_(sheet);
  for (let i = 0; i < data.length; i += 1) {
    if (String(data[i][column]) === String(value)) return i + 2;
  }
  return 0;
}

function setFields_(sheet, rowNumber, fields) {
  const headers = headerMap_(sheet);
  Object.keys(fields).forEach(function(key) {
    if (headers[key] === undefined || fields[key] === undefined) return;
    sheet.getRange(rowNumber, headers[key] + 1).setValue(fields[key]);
  });
}

function appendObject_(sheet, object) {
  const headers = SHEETS[sheet.getName()];
  const values = headers.map(function(key) { return object[key] === undefined ? "" : object[key]; });
  sheet.appendRow(values);
  return sheet.getLastRow();
}

function iso_(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? "" : date.toISOString();
}

function upsertSubscriber_(subscriber) {
  const chatId = String(subscriber.chat_id || "");
  if (!chatId) return { ok: false, error: "chat_id is required" };
  const sheet = sheet_("Subscribers");
  let row = findRow_(sheet, "chat_id", chatId);
  const now = new Date().toISOString();
  const existing = row ? getSubscriber_(chatId).subscriber : null;
  const fields = {
    chat_id: chatId,
    user_id: subscriber.user_id || (existing && existing.user_id) || "",
    username: subscriber.username || (existing && existing.username) || "",
    first_name: subscriber.first_name || (existing && existing.first_name) || "",
    last_name: subscriber.last_name || (existing && existing.last_name) || "",
    consent_status: subscriber.consent_status || (existing && existing.consent_status) || "pending",
    referral_code: subscriber.referral_code || (existing && existing.referral_code) || "",
    referred_by: subscriber.referred_by || (existing && existing.referred_by) || "",
    source: subscriber.source || (existing && existing.source) || "direct",
    started_at: (existing && existing.started_at) || now,
    last_seen_at: subscriber.last_seen_at || now,
    followup_stage: (existing && existing.followup_stage) || 0
  };
  if (!row) row = appendObject_(sheet, fields);
  else setFields_(sheet, row, fields);
  return { ok: true, subscriber: getSubscriber_(chatId).subscriber };
}

function setConsent_(payload) {
  const chatId = String(payload.chat_id || "");
  if (!chatId) return { ok: false, error: "chat_id is required" };
  const sheet = sheet_("Subscribers");
  let row = findRow_(sheet, "chat_id", chatId);
  if (!row) row = appendObject_(sheet, { chat_id: chatId, started_at: new Date().toISOString(), followup_stage: 0 });
  const status = String(payload.consent_status || "pending");
  const fields = { consent_status: status, last_seen_at: new Date().toISOString() };
  if (status === "subscribed") {
    fields.subscribed_at = payload.subscribed_at || new Date().toISOString();
    fields.unsubscribed_at = "";
    fields.blocked_at = "";
    fields.followup_stage = 0;
  }
  if (status === "unsubscribed") fields.unsubscribed_at = payload.unsubscribed_at || new Date().toISOString();
  setFields_(sheet, row, fields);
  log_("consent", chatId, status, "saved", "");
  return { ok: true, consent_status: status };
}

function getSubscriber_(chatId) {
  const sheet = sheet_("Subscribers");
  const rowNumber = findRow_(sheet, "chat_id", String(chatId || ""));
  if (!rowNumber) return { ok: true, subscriber: null };
  const headers = headerMap_(sheet);
  const row = sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getValues()[0];
  return { ok: true, subscriber: rowObject_(headers, row) };
}

function markVerified_(payload) {
  const sheet = sheet_("Subscribers");
  const chatId = String(payload.chat_id || "");
  let row = findRow_(sheet, "chat_id", chatId);
  if (!row) row = appendObject_(sheet, { chat_id: chatId, started_at: new Date().toISOString(), consent_status: "pending", followup_stage: 0 });
  setFields_(sheet, row, { verified_at: payload.verified_at || new Date().toISOString() });
  log_("membership", chatId, "verified", "saved", "");
  return { ok: true };
}

function recordReferral_(payload) {
  const referrer = String(payload.referrer_code || "");
  const newChatId = String(payload.new_chat_id || "");
  if (!referrer || !newChatId) return { ok: false, error: "referrer_code and new_chat_id are required" };
  const sheet = sheet_("Referrals");
  const duplicate = rows_(sheet).some(function(row) {
    return String(row[1]) === referrer && String(row[2]) === newChatId;
  });
  if (!duplicate) {
    appendObject_(sheet, {
      timestamp: payload.created_at || new Date().toISOString(),
      referrer_code: referrer,
      new_chat_id: newChatId,
      source: payload.source || "referral"
    });
  }
  return { ok: true, duplicate: duplicate };
}

function listDueFollowups_(payload) {
  const now = new Date(payload.now || new Date().toISOString());
  const limit = Math.max(1, Math.min(Number(payload.limit || 40), 100));
  const sheet = sheet_("Subscribers");
  const headers = headerMap_(sheet);
  const data = rows_(sheet);
  const due = [];

  data.forEach(function(row) {
    if (due.length >= limit) return;
    const item = rowObject_(headers, row);
    if (String(item.consent_status) !== "subscribed" || item.blocked_at) return;
    const subscribedAt = new Date(item.subscribed_at || item.started_at || 0);
    if (isNaN(subscribedAt.getTime())) return;
    const ageDays = (now.getTime() - subscribedAt.getTime()) / 86400000;
    const stage = Number(item.followup_stage || 0);
    let next = 0;
    if (stage < 1 && ageDays >= 1) next = 1;
    else if (stage < 2 && ageDays >= 3) next = 2;
    else if (stage < 3 && ageDays >= 7) next = 3;
    if (next) due.push({ chat_id: String(item.chat_id), first_name: item.first_name || "", stage: next });
  });

  return { ok: true, subscribers: due };
}

function markFollowup_(payload) {
  const sheet = sheet_("Subscribers");
  const chatId = String(payload.chat_id || "");
  const row = findRow_(sheet, "chat_id", chatId);
  if (row && String(payload.status || "") === "sent") {
    setFields_(sheet, row, { followup_stage: Number(payload.stage || 0), last_seen_at: payload.sent_at || new Date().toISOString() });
  }
  log_("followup", chatId, String(payload.stage || ""), payload.status || "unknown", payload.error || "");
  return { ok: true };
}

function markBlocked_(payload) {
  const sheet = sheet_("Subscribers");
  const chatId = String(payload.chat_id || "");
  const row = findRow_(sheet, "chat_id", chatId);
  if (row) setFields_(sheet, row, { consent_status: "blocked", blocked_at: new Date().toISOString() });
  log_("followup", chatId, String(payload.stage || ""), "blocked", payload.error || "");
  return { ok: true };
}

function channelPostExists_(postKey) {
  const sheet = sheet_("ChannelPosts");
  const row = findRow_(sheet, "post_key", String(postKey || ""));
  if (!row) return { ok: true, exists: false };
  const headers = headerMap_(sheet);
  const values = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
  const item = rowObject_(headers, values);
  return { ok: true, exists: String(item.status) === "sent", post: item };
}

function recordChannelPost_(payload) {
  const sheet = sheet_("ChannelPosts");
  const postKey = String(payload.post_key || "");
  if (!postKey) return { ok: false, error: "post_key is required" };
  let row = findRow_(sheet, "post_key", postKey);
  const fields = {
    post_key: postKey,
    queue_id: payload.queue_id || "",
    sent_at: payload.sent_at || new Date().toISOString(),
    message_id: payload.message_id || "",
    status: payload.status || "unknown",
    error: payload.error || ""
  };
  if (!row) row = appendObject_(sheet, fields);
  else setFields_(sheet, row, fields);

  if (payload.queue_id) {
    const queue = sheet_("ContentQueue");
    const queueRow = findRow_(queue, "id", String(payload.queue_id));
    if (queueRow) setFields_(queue, queueRow, {
      status: payload.status || "unknown",
      sent_at: fields.sent_at,
      message_id: fields.message_id,
      error: fields.error
    });
  }
  log_("channel", "", postKey, fields.status, fields.error);
  return { ok: true };
}

function listDueChannelPosts_(payload) {
  const now = new Date(payload.now || new Date().toISOString());
  const limit = Math.max(1, Math.min(Number(payload.limit || 3), 10));
  const sheet = sheet_("ContentQueue");
  const headers = headerMap_(sheet);
  const data = rows_(sheet);
  const posts = [];
  data.forEach(function(row) {
    if (posts.length >= limit) return;
    const item = rowObject_(headers, row);
    const status = String(item.status || "queued").toLowerCase();
    if (!["", "queued", "approved"].includes(status)) return;
    const scheduled = new Date(item.scheduled_at || 0);
    if (isNaN(scheduled.getTime()) || scheduled.getTime() > now.getTime()) return;
    if (!item.text_html) return;
    posts.push({
      id: String(item.id || ""),
      post_key: `queue-${String(item.id || "")}`,
      text_html: String(item.text_html),
      button_text: String(item.button_text || ""),
      button_url: String(item.button_url || "")
    });
  });
  return { ok: true, posts: posts };
}

function analytics_() {
  const subscriberSheet = sheet_("Subscribers");
  const headers = headerMap_(subscriberSheet);
  const data = rows_(subscriberSheet).map(function(row) { return rowObject_(headers, row); });
  const counts = { total: data.length, pending: 0, subscribed: 0, unsubscribed: 0, blocked: 0, verified: 0 };
  data.forEach(function(item) {
    const status = String(item.consent_status || "pending");
    if (counts[status] !== undefined) counts[status] += 1;
    if (item.verified_at) counts.verified += 1;
  });
  return { ok: true, subscribers: counts, referrals: Math.max(0, sheet_("Referrals").getLastRow() - 1), channel_posts: Math.max(0, sheet_("ChannelPosts").getLastRow() - 1) };
}

function log_(type, chatId, key, status, detail) {
  appendObject_(sheet_("DeliveryLog"), {
    timestamp: new Date().toISOString(),
    type: type,
    chat_id: chatId,
    key: key,
    status: status,
    detail: detail
  });
}
