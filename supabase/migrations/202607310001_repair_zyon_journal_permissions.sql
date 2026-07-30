grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.zyon_journal_entries to authenticated;

drop policy if exists "Users read their ZYON journal" on public.zyon_journal_entries;
create policy "Users read their ZYON journal"
  on public.zyon_journal_entries
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users insert their ZYON journal" on public.zyon_journal_entries;
create policy "Users insert their ZYON journal"
  on public.zyon_journal_entries
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users update their ZYON journal" on public.zyon_journal_entries;
create policy "Users update their ZYON journal"
  on public.zyon_journal_entries
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users delete their ZYON journal" on public.zyon_journal_entries;
create policy "Users delete their ZYON journal"
  on public.zyon_journal_entries
  for delete
  to authenticated
  using (auth.uid() = user_id);
