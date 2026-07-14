# GemAssist Telegram Growth Bot

A Vercel-hosted, opt-in Telegram bot and landing page for GEM Cybersecurity Assist.

## Supported flow

1. A user opens the bot voluntarily.
2. The bot presents the official channel link.
3. The user joins the channel by choice.
4. The bot verifies membership with Telegram `getChatMember`.
5. Verified users receive the guide link.
6. An optional Google Apps Script webhook records the verified lead.

This repository does **not** scrape member lists, force-add users, or bypass Telegram consent controls.

## Security controls

- No bot token fallback is stored in source code.
- Telegram webhook requests require `X-Telegram-Bot-Api-Secret-Token`.
- Webhook registration requires a separate `SETUP_KEY`.
- Membership verification fails closed when `CHANNEL_ID` is missing.
- Protected webhook diagnostics expose no secrets.

## Required Vercel variables

Copy `.env.example` into Vercel project settings and set at least:

- `BOT_TOKEN` — a newly rotated BotFather token
- `BOT_USERNAME` — username without `@`
- `CHANNEL_ID` — Telegram channel numeric ID
- `CHANNEL_URL` — public channel link or private invite
- `WEBHOOK_SECRET` — Telegram webhook secret token
- `SETUP_KEY` — long random key used only to register and inspect the webhook
- `PUBLIC_BASE_URL` — production URL, normally `https://mygemassistcontentbot.vercel.app`

## Register the webhook

After production deployment, send an authenticated POST request:

```bash
curl -X POST \
  -H "Authorization: Bearer $SETUP_KEY" \
  https://mygemassistcontentbot.vercel.app/api/set-webhook
```

Inspect Telegram webhook status:

```bash
curl \
  -H "Authorization: Bearer $SETUP_KEY" \
  https://mygemassistcontentbot.vercel.app/api/webhook-info
```

## Telegram prerequisites

- Add the bot to the target channel as an administrator.
- Give it the minimum permissions required to read membership status.
- Configure BotFather commands from `BOTFATHER_COMMANDS.txt`.
- Never commit bot tokens, setup keys, or webhook secrets.

## Incident note

A bot token was previously committed to this public repository. Treat that token as compromised and revoke it through BotFather before enabling production traffic. Removing it from the latest file does not invalidate the exposed credential or erase Git history.
