-- gemassist_status is an internal readiness helper. It reads protected tables and
-- does not require direct anonymous RPC access; signed gateway RPCs remain unchanged.
revoke execute on function public.gemassist_status() from anon;
