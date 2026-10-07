-- Remove direct RPC execution from the trigger-only profile seed function.
revoke execute on function public.frame_profile_seed() from public;
revoke execute on function public.frame_profile_seed() from anon;
revoke execute on function public.frame_profile_seed() from authenticated;

-- Call-room joins are already limited to authenticated users; keep the public/anon
-- roles explicitly revoked for defense in depth.
revoke execute on function public.join_frame_call(text,text) from public;
revoke execute on function public.join_frame_call(text,text) from anon;
grant execute on function public.join_frame_call(text,text) to authenticated;
