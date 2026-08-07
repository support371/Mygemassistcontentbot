-- Reduce RPC exposure without changing GemAssist's signed anonymous gateway path.
-- The production Vercel app uses the Supabase publishable key (anon role) plus
-- detached signatures and replay-protected nonces. No authenticated-role client
-- calls these functions, so authenticated EXECUTE is unnecessary.

revoke execute on function public.gemassist_gateway(text, text) from authenticated;
revoke execute on function public.gemassist_channel_snapshot_gateway(text, text) from authenticated;
revoke execute on function public.gemassist_status() from authenticated;
