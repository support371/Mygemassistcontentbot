const API = (token) => `https://api.telegram.org/bot${token}`;

function env(name, fallback = "") {
  return process.env[name] || fallback;
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

function welcomeKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "📢 Join Channel", url: env("CHANNEL_URL") }],
      [{ text: "✅ I Joined — Send My Guide", callback_data: "verify_join" }]
    ]
  };
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
      `👉 Step 1: Join our channel\n` +
      `👉 Step 2: Tap <b>I Joined ✅</b> below\n\n` +
      `Your guide will arrive instantly. 🚀`,
    reply_markup: welcomeKeyboard()
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
      } else if (text.startsWith("/latest_tools") || text.startsWith("/opportunities")) {
        await telegram("sendMessage", {
          chat_id: chatId,
          text: "Join the channel for daily useful tools, AI resources, opportunities, and productivity tips.",
          reply_markup: welcomeKeyboard()
        });
      } else if (text.startsWith("/services") || text.startsWith("/quote") || text.startsWith("/contact") || text.startsWith("/about")) {
        await telegram("sendMessage", {
          chat_id: chatId,
          text: "Thanks for reaching out. Use /start to unlock the free guide and stay connected with GemAssist updates."
        });
      } else {
        await telegram("sendMessage", {
          chat_id: chatId,
          text: "Use /start to unlock the free guide and join the channel.",
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
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(200).json({ ok: false, error: err.message });
  }
}
