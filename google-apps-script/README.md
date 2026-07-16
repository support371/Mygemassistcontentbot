# GemAssist Growth Store

This folder contains the optional Google Apps Script backend used for consent records, referral attribution, content scheduling, delivery logs, and the three-message onboarding sequence.

## Create the store

1. Create a blank Google Sheet named `GemAssist Growth Store`.
2. Open **Extensions → Apps Script**.
3. Replace the default script with `Code.gs` from this folder.
4. In **Project Settings → Script properties**, add:
   - `GROWTH_STORE_KEY` — the same long random value used in Vercel.
   - `SPREADSHEET_ID` — optional when the script is bound to the Sheet.
5. Run `doGet` once from the editor and approve the requested spreadsheet permission. The script creates:
   - `Subscribers`
   - `ContentQueue`
   - `DeliveryLog`
   - `ChannelPosts`
   - `Referrals`
6. Select **Deploy → New deployment → Web app**.
7. Execute as the owner and allow access to anyone who has the deployment URL.
8. Copy the `/exec` URL into Vercel as `GROWTH_STORE_URL`.
9. Save the matching key as `GROWTH_STORE_KEY` in Vercel.

The deployment URL acts as a capability endpoint. Keep it private and use `GROWTH_STORE_KEY` for an additional check.

## Content queue

Add approved rows to `ContentQueue`:

| Field | Purpose |
|---|---|
| `id` | Unique identifier such as `2026-07-20-alert-1` |
| `scheduled_at` | ISO date/time, for example `2026-07-20T14:00:00Z` |
| `text_html` | Telegram-compatible HTML text |
| `button_text` | Optional button label |
| `button_url` | Optional HTTPS URL |
| `status` | Use `approved` or `queued` |

The Vercel job publishes up to three due approved posts. When no queue row is due, it uses the built-in evergreen daily calendar.

## Consent behavior

- `/start` records a pending contact only when the store is connected.
- Automated follow-ups require the user to press **Enable helpful updates** or send `/updates`.
- The sequence contains no more than three messages over seven days.
- `/stop` and `/unsubscribe` immediately suppress future automated messages.
- Telegram blocks and inaccessible chats are marked and excluded from future delivery.
