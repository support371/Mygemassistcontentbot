# GemAssist Telegram Growth Bot

This is a Vercel-ready Telegram bot webhook and landing page for the GemAssist Telegram growth funnel.

## What it does

The bot welcomes users, asks them to join the Telegram channel, verifies membership, sends the free guide link, and can optionally save verified leads to a Google Sheets webhook.

## Files

- api/webhook.js
- api/set-webhook.js
- public/index.html
- package.json
- vercel.json
- .env.example
- BOTFATHER_COMMANDS.txt

## Vercel setup

Import this repository into Vercel, then add the environment variables listed in .env.example inside Vercel project settings.

After deployment, open the set-webhook endpoint once, then test the Telegram bot with the start command.

## Security

Keep real secrets only inside Vercel environment variables. Do not commit real bot tokens or private keys into GitHub.
