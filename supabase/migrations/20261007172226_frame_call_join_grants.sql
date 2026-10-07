-- Restrict the authenticated call-join RPC to signed-in users.
-- The function itself still validates auth.uid() before returning or mutating anything.
revoke execute on function public.join_frame_call(text,text) from public;
revoke execute on function public.join_frame_call(text,text) from anon;
grant execute on function public.join_frame_call(text,text) to authenticated;
