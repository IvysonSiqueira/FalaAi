-- Preparação LOCAL. Aplicar apenas após confirmar o projeto Supabase de destino.
-- Não substitui tabelas existentes. Colisão de nomes aborta a transação para revisão.
-- Não inclui Storage, exclusão de conta, consentimento ou dados demonstrativos.
begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
revoke all on public.profiles from public, anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- O perfil é criado junto ao usuário Auth, sem corrida entre cadastro e confirmação.
-- Metadata só fornece o nome de exibição; nunca concede privilégios.
create function public.falaai_create_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), 'Participante'), 80));
  return new;
end;
$$;
revoke all on function public.falaai_create_profile() from public, anon, authenticated;
create trigger falaai_auth_user_created
  after insert on auth.users
  for each row execute function public.falaai_create_profile();

-- Inclui usuários já existentes sem alterar dados do Auth ou perfis existentes.
insert into public.profiles (id, display_name)
select id, left(coalesce(nullif(btrim(raw_user_meta_data ->> 'name'), ''), 'Participante'), 80)
from auth.users on conflict (id) do nothing;

create table public.occurrences (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category_id text not null check (category_id in ('buraco', 'iluminacao', 'lixo', 'vazamento', 'calcada', 'outros')),
  description text not null check (char_length(btrim(description)) between 20 and 400),
  location text check (location is null or char_length(btrim(location)) between 1 and 200),
  latitude double precision,
  longitude double precision,
  photo_path text check (photo_path is null or
    (char_length(photo_path) between 1 and 512 and photo_path like author_id::text || '/%')),
  status text not null default 'Aberta' check (status in ('Aberta', 'Em análise', 'Resolvida')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint occurrences_valid_coordinates check (
    (latitude is null and longitude is null) or
    (latitude is not null and longitude is not null and latitude between -90 and 90 and longitude between -180 and 180)
  ),
  constraint occurrences_has_location check (location is not null or latitude is not null)
);
create index occurrences_author_created_idx on public.occurrences (author_id, created_at desc);
create index occurrences_created_idx on public.occurrences (created_at desc);

alter table public.occurrences enable row level security;
revoke all on public.occurrences from public, anon, authenticated;
grant select on public.occurrences to authenticated;
-- Proprietário, ID, status e datas vêm do servidor; cliente não pode forjá-los.
grant insert (category_id, description, location, latitude, longitude, photo_path)
  on public.occurrences to authenticated;
grant update (category_id, description, location, latitude, longitude, photo_path)
  on public.occurrences to authenticated;
grant delete on public.occurrences to authenticated;

create policy occurrences_select_community on public.occurrences
  for select to authenticated using (
    exists (select 1 from public.profiles where id = (select auth.uid()))
  );
create policy occurrences_insert_own on public.occurrences
  for insert to authenticated with check (
    author_id = (select auth.uid()) and
    exists (select 1 from public.profiles where id = (select auth.uid()))
  );
create policy occurrences_update_own on public.occurrences
  for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));
create policy occurrences_delete_own on public.occurrences
  for delete to authenticated using (author_id = (select auth.uid()));

create function public.falaai_touch_occurrence()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.falaai_touch_occurrence() from public, anon, authenticated;
create trigger falaai_occurrence_updated
  before update on public.occurrences
  for each row execute function public.falaai_touch_occurrence();

commit;
