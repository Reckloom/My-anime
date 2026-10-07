create or replace function public.validate_frame_release_tracker_key(p_key text)
returns boolean
language plpgsql
security definer
set search_path = public, vault
as $$
declare expected text;
begin
  select decrypted_secret into expected
  from vault.decrypted_secrets
  where name='frame_release_tracker_secret'
  limit 1;
  return expected is not null and p_key = expected;
end;
$$;
revoke all on function public.validate_frame_release_tracker_key(text) from public, anon, authenticated;
grant execute on function public.validate_frame_release_tracker_key(text) to service_role;
