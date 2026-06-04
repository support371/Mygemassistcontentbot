const API = (token) => `https://api.telegram.org/bot${token}`;

function env(name, fallback = "") {
  return process.env[name] || fallback;
}

function hasUrl(value) {
  return Boolean(value && value.startsWith("http"));
}

async function telegram(method, payload) {
  const token = env("BOT_TOKEN");
  if (!token) throw new Error("BOT_TOKEN is missing");

  const res = await fetch(`${API(token)}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!data.ok) console.error("Telegram API error", method, data);
  return data;
}

async function saveLead(lead) {
  const url = env("GOOGLE_APPS_SCRIPT_WEBHOOK");
  if (!url) return;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(lead)
    });
  } catch (err) {
    console.error("Lead save failed", err.message);
  }
}

function socialButtons() {
  const rows = [];
  const twitterUrl = env("TWITTER_URL");
  const tiktokUrl = env("TIKTOK_URL");
  const facebookUrl = env("FACEBOOK_URL");
  const instagramUrl = env("INSTAGRAM_URL");

  if (hasUrl(twitterUrl)) rows.push([{ text: "𝕏 Follow on X / Twitter", url: twitterUrl }]);
  if (hasUrl(tiktokUrl)) rows.push([{ text: "🎵 Follow on TikTok", url: tiktokUrl }]);
  if (hasUrl(facebookUrl)) rows.push([{ text: "📘 Follow Facebook Page", url: facebookUrl }]);
  if (hasUrl(instagramUrl)) rows.push([{ text: "📸 Follow Instagram", url: instagramUrl }]);

  return rows;
}

function socialKeyboard() {
  const rows = socialButtons();
  if (hasUrl(env("CHANNEL_URL"))) rows.push([{ text: "📢 Join Telegram Channel", url: env("CHANNEL_URL") }]);
  return { inline_keyboard: rows.length ? rows : [[{ text: "📢 Join Telegram Channel", url: env("CHANNEL_URL", "https://t.me/Gemassistbuilder_Bot") }]] };
}

function welcomeKeyboard() {
  const rows = [
    [{ text: "📢 Join Telegram Channel", url: env("CHANNEL_URL") }],
    [{ text: "✅ I Joined — Send My Guide", callback_data: "verify_join" }],
    [{ text: "🌍 Follow Our Social Pages", callback_data: "show_socials" }]
  ];
  return { inline_keyboard: rows };
}

async function sendWelcome(chatId, firstName = "") {
  const name = firstName ? ` ${firstName}` : "";

  return telegram("sendMessage", {
    chat_id: chatId,
    parse_mode: "HTML",
    text:
      `👋 Welcome${name}!\n\n` +
      `You’re 30 seconds away from getting your FREE guide:\n\n` +
      `📕 <b>50 Free Tools & Opportunities Every Creator Should Know</b>\n\n` +
      `Inside you’ll find AI tools, free resources, productivity tools, and opportunity sources.\n\n` +
      `👉 Step 1: Join our Telegram channel\n` +
      `👉 Step 2: Tap <b>I Joined ✅</b> below\n` +
      `👉 Step 3: Follow our X/Twitter, TikTok, and Facebook pages for extra updates\n\n` +
      `Your guide will arrive instantly. 🚀`,
    reply_markup: welcomeKeyboard()
  });
}

async function sendSocialHub(chatId) {
  return telegram("sendMessage", {
    chat_id: chatId,
    parse_mode: "HTML",
    text:
      `🌍 <b>Follow GemAssist Everywhere</b>\n\n` +
      `Stay connected across our platforms for updates, tools, opportunities, service announcements, and short-form tips.\n\n` +
      `Use the buttons below to follow the pages you use most.`,
    reply_markup: socialKeyboard()
  });
}

async function verifyUser(userId) {
  const channelId = env("CHANNEL_ID");
  const result = await telegram("getChatMember", {
    chat_id: channelId,
    user_id: userId
  });

  if (!result.ok) return false;
  const status = result.result?.status;
  return ["member", "administrator", "creator"].includes(status);
}

async function sendGuide(chatId, user) {
  await telegram("sendMessage", {
    chat_id: chatId,
    parse_mode: "HTML",
    text:
      `🎉 You’re in! Here’s your free guide.\n\n` +
      `<b>50 Free Tools & Opportunities Every Creator Should Know</b>\n\n` +
      `${env("PDF_URL")}\n\n` +
      `Save it, use it, and stay in the channel for daily useful drops. 🚀`
  });

  await saveLead({
    user_id: user.id,
    first_name: user.first_name || "",
    username: user.username || "",
    source: "telegram_bot",
    joined_at: new Date().toISOString(),
    verified: true,
    pdf_sent: true
  });

  await telegram("sendMessage", {
    chat_id: chatId,
    parse_mode: "HTML",
    text:
      `🚀 <b>Next step: follow GemAssist on other platforms</b>\n\n` +
      `Telegram is where you get the full drops, but X/Twitter, TikTok, and Facebook help you catch quick updates, short tips, and public announcements.`,
    reply_markup: socialKeyboard()
  });
}

async function sendNotJoined(chatId) {
  return telegram("sendMessage", {
    chat_id: chatId,
    parse_mode: "HTML",
    text:
      `Hmm, it looks like you haven’t joined yet 🤔\n\n` +
      `Tap the button below to join, then come back and tap <b>I Joined ✅</b>.\n\n` +
      `Your guide is waiting 🎁`,
    reply_markup: welcomeKeyboard()
  });
}

async function sendServices(chatId) {
  return telegram("sendMessage", {
    chat_id: chatId,
    parse_mode: "HTML",
    text:
      `🛠 <b>GemAssist Services</b>\n\n` +
      `We help with digital systems, automation setup, growth funnels, business support workflows, content systems, and online presence improvement.\n\n` +
      `Use /quote to request help or /socials to follow our pages.`
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("GemAssist Telegram webhook is running.");
  }

  const secret = env("SECRET_TOKEN");
  if (secret && req.headers["x-telegram-bot-api-secret-token"] !== secret) {
    return res.status(401).json({ ok: false, error: "Invalid secret token" });
  }

  try {
    const update = req.body;

    if (update.message) {
      const msg = update.message;
      const text = msg.text || "";
      const chatId = msg.chat.id;

      if (text.startsWith("/start") || text.startsWith("/free_guide") || text.startsWith("/subscribe")) {
        await sendWelcome(chatId, msg.from?.first_name);
      } else if (text.startsWith("/socials") || text.startsWith("/follow") || text.startsWith("/twitter") || text.startsWith("/tiktok") || text.startsWith("/facebook")) {
        await sendSocialHub(chatId);
      } else if (text.startsWith("/latest_tools") || text.startsWith("/opportunities")) {
        await telegram("sendMessage", {
          chat_id: chatId,
          parse_mode: "HTML",
          text: "Join the channel for daily useful tools, AI resources, opportunities, and productivity tips. You can also follow our social pages below.",
          reply_markup: socialKeyboard()
        });
      } else if (text.startsWith("/services")) {
        await sendServices(chatId);
      } else if (text.startsWith("/quote") || text.startsWith("/contact") || text.startsWith("/about")) {
        await telegram("sendMessage", {
          chat_id: chatId,
          parse_mode: "HTML",
          text:
            `Thanks for reaching out.\n\n` +
            `Use /start to unlock the free guide, /socials to follow our pages, or reply with what service you need.`
        });
      } else {
        await telegram("sendMessage", {
          chat_id: chatId,
          text: "Use /start to unlock the free guide, /subscribe to join the channel, or /socials to follow our pages.",
          reply_markup: welcomeKeyboard()
        });
      }
    }

    if (update.callback_query) {
      const cb = update.callback_query;
      const chatId = cb.message.chat.id;
      const user = cb.from;

      await telegram("answerCallbackQuery", { callback_query_id: cb.id });

      if (cb.data === "verify_join") {
        if (user.is_bot) {
          await telegram("sendMessage", { chat_id: chatId, text: "Bot accounts cannot unlock the guide." });
        } else {
          const verified = await verifyUser(user.id);
          if (verified) await sendGuide(chatId, user);
          else await sendNotJoined(chatId);
        }
      }

      if (cb.data === "show_socials") {
        await sendSocialHub(chatId);
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(200).json({ ok: false, error: err.message });
  }
}
