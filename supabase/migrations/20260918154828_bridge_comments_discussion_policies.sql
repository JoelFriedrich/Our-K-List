-- The list owner can always write and read the discussion on their own entry,
-- even with allow_comments off (their review now lives here).
drop policy if exists "Friends can post comments" on "Comments";
create policy "Friends can post comments" on "Comments"
  for insert to public
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from "User_shows" us
      where us.id = "Comments".user_show_id
        and (
          us.user_id = auth.uid()
          or (
            exists (select 1 from "Profiles" p where p.id = us.user_id and p.allow_comments = true)
            and exists (
              select 1 from "Friendships" f
              where f.status = 'accepted'
                and (
                  (f.user_id = auth.uid() and f.friend_id = us.user_id)
                  or (f.friend_id = auth.uid() and f.user_id = us.user_id)
                )
            )
          )
        )
    )
  );

drop policy if exists "Friends can read comments" on "Comments";
create policy "Friends can read comments" on "Comments"
  for select to public
  using (
    auth.uid() = user_id
    or exists (
      select 1 from "User_shows" us
      where us.id = "Comments".user_show_id
        and (
          us.user_id = auth.uid()
          or (
            exists (select 1 from "Profiles" p where p.id = us.user_id and p.allow_comments = true)
            and exists (
              select 1 from "Friendships" f
              where f.status = 'accepted'
                and (
                  (f.user_id = auth.uid() and f.friend_id = us.user_id)
                  or (f.friend_id = auth.uid() and f.user_id = us.user_id)
                )
            )
          )
        )
    )
  );

-- The list owner can moderate (delete) comments left on their own entry.
drop policy if exists "Users delete own comments" on "Comments";
create policy "Users delete own comments" on "Comments"
  for delete to public
  using (
    auth.uid() = user_id
    or exists (
      select 1 from "User_shows" us
      where us.id = "Comments".user_show_id and us.user_id = auth.uid()
    )
  );
