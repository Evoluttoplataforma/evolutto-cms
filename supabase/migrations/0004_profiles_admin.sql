-- Perfis: permitir que a equipe logada veja e gerencie todos os usuários do CMS.
-- (A policy antiga só deixava cada um ver o próprio perfil.)
-- Rodar 1x no SQL Editor.

-- 1) Cria automaticamente um perfil quando um usuário é criado no Auth
create or replace function public.evolutto_handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.evolutto_profiles (id, email, nome)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists evolutto_on_auth_user_created on auth.users;
create trigger evolutto_on_auth_user_created
  after insert on auth.users
  for each row execute function public.evolutto_handle_new_user();

-- 2) Backfill: cria perfil para usuários do Auth que ainda não têm
insert into public.evolutto_profiles (id, email, nome)
select u.id, u.email, coalesce(u.raw_user_meta_data->>'nome', split_part(u.email, '@', 1))
from auth.users u
on conflict (id) do nothing;

-- 3) Policies: equipe autenticada vê e gerencia todos os perfis
drop policy if exists "evo_auth_profiles" on evolutto_profiles;
create policy "evo_profiles_select" on evolutto_profiles
  for select using (auth.role() = 'authenticated');
create policy "evo_profiles_update" on evolutto_profiles
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "evo_profiles_delete" on evolutto_profiles
  for delete using (auth.role() = 'authenticated');
