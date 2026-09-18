-- Trigger functions are never meant to be called over the API.
revoke execute on function public.assign_comment_is_review() from anon, authenticated, public;
revoke execute on function public.sync_user_show_review() from anon, authenticated, public;
revoke execute on function public.sync_comment_likes_count() from anon, authenticated, public;

-- The migration backup is service-role only.
revoke all on table "Legacy_user_show_comments" from anon, authenticated;
