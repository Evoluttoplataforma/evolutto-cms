-- Storage para imagens do blog (capas, foto do autor, imagens inline).
-- Bucket PÚBLICO (leitura livre p/ aparecer no site); upload só p/ equipe logada.
-- Rodar 1x no SQL Editor do Supabase.

insert into storage.buckets (id, name, public)
values ('evolutto-media', 'evolutto-media', true)
on conflict (id) do update set public = true;

-- Leitura pública (qualquer um vê as imagens do bucket)
drop policy if exists "evo_media_read" on storage.objects;
create policy "evo_media_read" on storage.objects
  for select using (bucket_id = 'evolutto-media');

-- Upload / alteração / remoção: só usuário autenticado (equipe)
drop policy if exists "evo_media_insert" on storage.objects;
create policy "evo_media_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'evolutto-media');

drop policy if exists "evo_media_update" on storage.objects;
create policy "evo_media_update" on storage.objects
  for update to authenticated using (bucket_id = 'evolutto-media') with check (bucket_id = 'evolutto-media');

drop policy if exists "evo_media_delete" on storage.objects;
create policy "evo_media_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'evolutto-media');
