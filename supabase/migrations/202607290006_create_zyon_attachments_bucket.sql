insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'zyon-attachments',
  'zyon-attachments',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/json'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users read their ZYON attachments" on storage.objects;
create policy "Users read their ZYON attachments"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'zyon-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users upload their ZYON attachments" on storage.objects;
create policy "Users upload their ZYON attachments"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'zyon-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users update their ZYON attachments" on storage.objects;
create policy "Users update their ZYON attachments"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'zyon-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'zyon-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users delete their ZYON attachments" on storage.objects;
create policy "Users delete their ZYON attachments"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'zyon-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
