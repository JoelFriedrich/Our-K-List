-- A root comment written by the list owner on their own entry is their review.
create or replace function public.assign_comment_is_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
  owner_show_id uuid;
begin
  select user_id, show_id into owner_id, owner_show_id
  from "User_shows" where id = new.user_show_id;

  if new.show_id is null then
    new.show_id := owner_show_id;
  end if;

  if new.parent_id is null
     and not new.is_review
     and owner_id = new.user_id
     and not exists (select 1 from "Comments" where user_show_id = new.user_show_id and is_review)
  then
    new.is_review := true;
  end if;

  return new;
end;
$$;

drop trigger if exists comments_assign_is_review on "Comments";
create trigger comments_assign_is_review
  before insert on "Comments"
  for each row execute function public.assign_comment_is_review();

-- Keep User_shows.comments / is_spoiler as a read-only mirror of the review
-- comment, so list cards and search keep working off a single source of truth.
create or replace function public.sync_user_show_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_show uuid;
  review_body text;
  review_spoiler boolean;
begin
  if tg_op = 'DELETE' then
    target_user_show := old.user_show_id;
  else
    target_user_show := new.user_show_id;
  end if;

  select body, is_spoiler into review_body, review_spoiler
  from "Comments"
  where user_show_id = target_user_show and is_review
  limit 1;

  update "User_shows"
  set comments = coalesce(review_body, ''),
      is_spoiler = coalesce(review_spoiler, false)
  where id = target_user_show;

  return null;
end;
$$;

drop trigger if exists comments_sync_review on "Comments";
create trigger comments_sync_review
  after insert or update or delete on "Comments"
  for each row execute function public.sync_user_show_review();

-- Maintain the denormalised like counter.
create or replace function public.sync_comment_likes_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update "Comments" set likes_count = likes_count + 1 where id = new.comment_id;
  elsif tg_op = 'DELETE' then
    update "Comments" set likes_count = greatest(likes_count - 1, 0) where id = old.comment_id;
  end if;
  return null;
end;
$$;

drop trigger if exists comment_likes_count_sync on "Comment_likes";
create trigger comment_likes_count_sync
  after insert or delete on "Comment_likes"
  for each row execute function public.sync_comment_likes_count();
