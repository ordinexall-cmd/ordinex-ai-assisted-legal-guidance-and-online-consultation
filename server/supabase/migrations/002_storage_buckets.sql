-- Ordinex Supabase Storage buckets (run in SQL Editor after enabling Storage)
-- Then create matching buckets in Dashboard → Storage if insert fails.

insert into storage.buckets (id, name, public)
values
  ('documents', 'documents', true),
  ('avatars', 'avatars', true),
  ('consultations', 'consultations', true),
  ('reports', 'reports', true)
on conflict (id) do nothing;

-- Public read for uploaded assets (service_role bypasses RLS for server uploads)
create policy "public_read_documents" on storage.objects
  for select to public using (bucket_id = 'documents');

create policy "public_read_avatars" on storage.objects
  for select to public using (bucket_id = 'avatars');

create policy "public_read_consultations" on storage.objects
  for select to public using (bucket_id = 'consultations');

create policy "public_read_reports" on storage.objects
  for select to public using (bucket_id = 'reports');

-- Service role uploads from API (server uses SUPABASE_SERVICE_KEY)
create policy "service_upload_documents" on storage.objects
  for insert to service_role with check (bucket_id in ('documents', 'avatars', 'consultations', 'reports'));

create policy "service_update_documents" on storage.objects
  for update to service_role using (bucket_id in ('documents', 'avatars', 'consultations', 'reports'));
