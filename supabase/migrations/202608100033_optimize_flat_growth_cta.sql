-- Evidence-triggered CTA optimization after 48 hours of flat Telegram channel growth.
-- Scope is intentionally narrow: only the next approved, unsent queue item is changed.
-- Preserve the existing tracked deep link and posting cadence.
update public.gemassist_content_queue
set button_text = 'Verify a job before applying'
where id = '2026-07-22-opportunity-research'
  and status = 'approved'
  and sent_at is null
  and button_text = 'Check an opportunity';
