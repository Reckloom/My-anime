-- Trigger functions are invoked by PostgreSQL triggers, not directly by client RPC.
-- Remove unnecessary API-role execution grants while preserving trigger execution.
REVOKE EXECUTE ON FUNCTION public.frame_one_piece_assign_episode_arc() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.frame_one_piece_reconcile_arc_episodes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.frame_one_piece_recount_episode_parents() FROM PUBLIC, anon, authenticated;
