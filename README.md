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

## AI assistant and daily posts (no Claude or ChatGPT dependency)

`lib/llm.js` routes requests to OpenAI's open-weight **gpt-oss** models through free tiers, in order:

1. Cloudflare Workers AI: `@cf/openai/gpt-oss-120b`, then `@cf/openai/gpt-oss-20b` (10,000 free Neurons per day; requests fail rather than bill when the allowance is used)
2. OpenRouter free tier: `openai/gpt-oss-120b:free` (50 requests per day without purchased credits)
3. Hugging Face router (optional)

Set the keys for any of them in Vercel (`CF_ACCOUNT_ID` + `CF_AI_TOKEN`, `OPENROUTER_API_KEY`, `HF_TOKEN`). With none set, or all out of quota, everything falls back to the existing built-in content.

- **Bot:** `/ask <question>` and free-text messages get an AI answer grounded in GEM services and pricing.
- **Channel:** the 14:00 UTC post is written fresh by the model from the day's evergreen topic; the static post is the fallback.

## TikTok autopost

`.github/workflows/tiktok-autopost.yml` runs `scripts/tiktok/autopost.mjs` on GitHub Actions (free for this public repository):

1. gpt-oss writes the hook, a 25 to 35 second voiceover, footage searches and caption, rotating cybersecurity, real estate, finance and legal. Built-in scripts are used when no AI key is set.
2. Real-person stock footage comes from the Pexels API.
3. Piper (open-source text-to-speech) records the voiceover; espeak-ng is the fallback.
4. ffmpeg renders a 1080x1920 H.264 video with the hook on screen.
5. The video is published through the TikTok Content Posting API (Direct Post, file upload).

### Turn it on

1. In the TikTok developer portal, add `https://mygemassistcontentbot.vercel.app/api/tiktok-auth` as a redirect URI for the GEM Enterprise app.
2. In Vercel, set `TIKTOK_CLIENT_KEY` and `TIKTOK_CLIENT_SECRET`.
3. Open `https://mygemassistcontentbot.vercel.app/api/tiktok-auth?key=<SETUP_KEY>`, sign in to the TikTok account that should post, and copy the refresh token the page shows.
4. In GitHub (Settings, Secrets and variables, Actions), add secrets `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REFRESH_TOKEN`, `PEXELS_API_KEY` and the AI keys above.
5. Run the workflow manually with **dry run** checked and download the video from the run's artifacts to review it.
6. Add the repository variable `TIKTOK_AUTOPOST=on` to start the three scheduled runs a day (13:17, 17:47 and 21:23 UTC). Optional variable `TIKTOK_PRIVACY` (for example `SELF_ONLY` while testing).

TikTok limits each user token to 6 posting requests per minute and enforces daily posting caps; refresh tokens last about a year, after which step 3 is repeated.

## Incident note

A bot token was previously committed to this public repository. Treat that token as compromised and revoke it through BotFather before enabling production traffic. Removing it from the latest file does not invalidate the exposed credential or erase Git history.
