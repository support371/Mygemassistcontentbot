-- Restore the anonymous readiness RPC required by the production growth-status path.
-- The function returns aggregate readiness/count metadata only; signed state-changing gateways remain separate.
grant execute on function public.gemassist_status() to anon;
