-- LOCAL: revisar/aplicar apenas após confirmar o projeto falaai-prova3.
-- Criar o bucket pelo painel/API ANTES (ver docs/PROVA-III-STORAGE.md).
-- Não modifica a migração inicial, não apaga arquivos/metadata de Storage por SQL.
begin;

do $$
begin
  if not exists (select 1 from storage.buckets where id = 'occurrence-photos'
    and public = false and file_size_limit = 5242880
    and allowed_mime_types @> array['image/jpeg','image/png','image/webp']::text[]
    and allowed_mime_types <@ array['image/jpeg','image/png','image/webp']::text[]) then
    raise exception 'Crie/revise pelo painel o bucket privado occurrence-photos: 5242880 bytes; JPEG, PNG e WebP apenas.';
  end if;
  if to_regprocedure('storage.allow_only_operation(text)') is null then
    raise exception 'Storage sem allow_only_operation(text). Pare e revise a compatibilidade; não amplie SELECT para permitir downloads de reservas.';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'storage.objects'::regclass) then
    raise exception 'RLS de storage.objects não está habilitado. Pare e revise o projeto.';
  end if;
  if not has_table_privilege('authenticated','storage.objects','SELECT')
    or not has_table_privilege('authenticated','storage.objects','INSERT')
    or not has_table_privilege('authenticated','storage.objects','DELETE') then
    raise exception 'Privilégios padrão de Storage ausentes. Não conceder permissões globais sem revisar.';
  end if;
  if exists (select 1 from public.occurrences where photo_path is not null) then
    raise exception 'Há photo_path anterior à integração. Revisar/backfill antes de aplicar, sem apagar dados.';
  end if;
end;
$$;

-- Registro durável de cada upload e da limpeza pendente. Sem CASCADE: um futuro
-- fluxo de exclusão de conta terá de limpar arquivos antes de remover o usuário.
create table public.occurrence_photo_files (
  path text primary key,
  owner_id uuid not null references auth.users(id) on delete restrict,
  state text not null default 'pending' check (state in ('pending','uploaded','linked','cleanup')),
  created_at timestamptz not null default now(),
  cleanup_after timestamptz not null default now(),
  constraint occurrence_photo_files_path check (
    path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
    and split_part(path,'/',1) = owner_id::text
  )
);
create index occurrence_photo_files_cleanup_idx on public.occurrence_photo_files (owner_id,state,created_at);
alter table public.occurrence_photo_files enable row level security;
revoke all on public.occurrence_photo_files from public, anon, authenticated;
grant select on public.occurrence_photo_files to authenticated;
create policy occurrence_photo_files_select_own on public.occurrence_photo_files
  for select to authenticated using (owner_id = (select auth.uid()));

create function public.reserve_occurrence_photo(p_extension text) returns text
language plpgsql security definer set search_path = '' as $$
declare owner uuid := auth.uid(); new_path text;
begin
  if owner is null or not exists (select 1 from public.profiles where id = owner) then
    raise exception 'Autenticação e perfil exigidos' using errcode = '42501';
  end if;
  if p_extension is null or p_extension not in ('jpg','png','webp') then
    raise exception 'Formato não permitido' using errcode = '22023';
  end if;
  new_path := owner::text || '/' || gen_random_uuid()::text || '.' || p_extension;
  insert into public.occurrence_photo_files(path,owner_id) values (new_path,owner);
  return new_path;
end;
$$;

-- Só depois do ACK da API de upload. Falha/ausência de ACK conserva uma janela
-- de 24h antes de limpar, evitando encerrar a reserva com upload ainda em trânsito.
create function public.confirm_occurrence_photo_upload(p_path text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.occurrence_photo_files f set state = 'uploaded'
  where f.path = p_path and f.owner_id = auth.uid() and f.state = 'pending'
    and exists (select 1 from storage.objects where bucket_id = 'occurrence-photos' and name = p_path);
  return found;
end;
$$;

create function public.abandon_occurrence_photo(p_path text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  -- Se o insert/update foi confirmado mas sua resposta se perdeu, state=linked
  -- impede apagar a imagem já vinculada. Falha de rede não vira rollback cego.
  update public.occurrence_photo_files set state = 'cleanup',
    cleanup_after = case when state = 'pending' then now() + interval '24 hours' else now() end
  where path = p_path and owner_id = auth.uid() and state in ('pending','uploaded')
    and not exists (select 1 from public.occurrences where photo_path = p_path);
  return found;
end;
$$;

create function public.claim_occurrence_photo_cleanup() returns setof text
language plpgsql security definer set search_path = '' as $$
begin
  -- Upload interrompido: reserva expirada não depende do armazenamento do celular.
  -- Limite evita trabalho ilimitado a cada foco de tela. Repetir para mais lotes.
  return query
  with candidates as (
    select f.path from public.occurrence_photo_files f
    where f.owner_id = auth.uid()
      and ((f.state = 'cleanup' and f.cleanup_after <= now()) or (f.state in ('pending','uploaded') and f.created_at < now() - interval '24 hours'))
      and not exists (select 1 from public.occurrences o where o.photo_path = f.path)
    order by f.created_at, f.path limit 20 for update skip locked
  )
  update public.occurrence_photo_files f set state = 'cleanup', cleanup_after = now()
  from candidates c where f.path = c.path returning f.path;
end;
$$;

create function public.finish_occurrence_photo_cleanup(p_path text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare registered public.occurrence_photo_files%rowtype;
begin
  if auth.uid() is null or p_path is null or split_part(p_path,'/',1) <> auth.uid()::text then return false; end if;
  select * into registered from public.occurrence_photo_files where path = p_path for update;
  if found and (registered.owner_id <> auth.uid() or registered.state <> 'cleanup' or registered.cleanup_after > now()) then return false; end if;
  -- API remove pode retornar [] por ausência OU por RLS. Conferir evita falso sucesso.
  if exists (select 1 from storage.objects where bucket_id = 'occurrence-photos' and name = p_path)
    or exists (select 1 from public.occurrences where photo_path = p_path) then return false; end if;
  delete from public.occurrence_photo_files where path = p_path and owner_id = auth.uid() and state = 'cleanup';
  return true;
end;
$$;

revoke all on function public.reserve_occurrence_photo(text) from public, anon, authenticated;
revoke all on function public.confirm_occurrence_photo_upload(text) from public, anon, authenticated;
revoke all on function public.abandon_occurrence_photo(text) from public, anon, authenticated;
revoke all on function public.claim_occurrence_photo_cleanup() from public, anon, authenticated;
revoke all on function public.finish_occurrence_photo_cleanup(text) from public, anon, authenticated;
grant execute on function public.reserve_occurrence_photo(text) to authenticated;
grant execute on function public.confirm_occurrence_photo_upload(text) to authenticated;
grant execute on function public.abandon_occurrence_photo(text) to authenticated;
grant execute on function public.claim_occurrence_photo_cleanup() to authenticated;
grant execute on function public.finish_occurrence_photo_cleanup(text) to authenticated;

create unique index occurrences_unique_photo_path on public.occurrences (photo_path) where photo_path is not null;

create function public.falaai_link_occurrence_photo() returns trigger
language plpgsql security definer set search_path = '' as $$
declare previous_path text; registered public.occurrence_photo_files%rowtype;
begin
  if tg_op = 'UPDATE' then
    if new.photo_path is not distinct from old.photo_path then return new; end if;
    previous_path := old.photo_path;
  end if;
  if new.photo_path is not null then
    select * into registered from public.occurrence_photo_files where path = new.photo_path for update;
    if not found or registered.owner_id <> new.author_id or registered.state <> 'uploaded' then
      raise exception 'Reserva de fotografia inválida ou já usada' using errcode = '23514';
    end if;
    if not exists (select 1 from storage.objects where bucket_id = 'occurrence-photos' and name = new.photo_path) then
      raise exception 'Upload precisa estar confirmado antes de vincular foto' using errcode = '23514';
    end if;
    update public.occurrence_photo_files set state = 'linked' where path = new.photo_path;
  end if;
  if previous_path is not null then
    update public.occurrence_photo_files set state = 'cleanup', cleanup_after = now()
      where path = previous_path and owner_id = new.author_id;
    if not found then raise exception 'Registro de recuperação da foto anterior ausente'; end if;
  end if;
  return new;
end;
$$;
revoke all on function public.falaai_link_occurrence_photo() from public, anon, authenticated;
create trigger falaai_link_occurrence_photo
  before insert or update of photo_path on public.occurrences
  for each row execute function public.falaai_link_occurrence_photo();

create function public.falaai_queue_deleted_photo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.photo_path is not null then
    update public.occurrence_photo_files set state = 'cleanup', cleanup_after = now()
      where path = old.photo_path and owner_id = old.author_id;
    if not found then raise exception 'Registro de recuperação ausente; exclusão cancelada'; end if;
  end if;
  return old;
end;
$$;
revoke all on function public.falaai_queue_deleted_photo() from public, anon, authenticated;
create trigger falaai_queue_deleted_photo after delete on public.occurrences
  for each row execute function public.falaai_queue_deleted_photo();

-- Restrições de bucket evitam que políticas permissivas antigas/alheias abram
-- este bucket. Não mudam o acesso a outros buckets, nem grants globais de Storage.
create policy falaai_photos_anon_guard on storage.objects as restrictive
  for all to anon using (bucket_id <> 'occurrence-photos') with check (bucket_id <> 'occurrence-photos');

create policy falaai_photos_insert_guard on storage.objects as restrictive
  for insert to authenticated with check (bucket_id <> 'occurrence-photos' or exists (
    select 1 from public.occurrence_photo_files f where f.path = name and f.owner_id = (select auth.uid()) and f.state = 'pending'
  ));
create policy falaai_photos_insert_own on storage.objects
  for insert to authenticated with check (bucket_id = 'occurrence-photos' and exists (
    select 1 from public.occurrence_photo_files f where f.path = name and f.owner_id = (select auth.uid()) and f.state = 'pending'
  ));

-- Atualizações in-place/upsert/copy/move não fazem parte do app. Substituição usa
-- novo caminho e update do relato, evitando destruir o arquivo antigo prematuramente.
create policy falaai_photos_update_guard on storage.objects as restrictive
  for update to authenticated using (bucket_id <> 'occurrence-photos') with check (bucket_id <> 'occurrence-photos');

create policy falaai_photos_select_guard on storage.objects as restrictive
  for select to authenticated using (bucket_id <> 'occurrence-photos' or (
    exists (select 1 from public.occurrences o where o.photo_path = name)
    or ((storage.allow_only_operation('storage.object.delete_many') or storage.allow_only_operation('storage.object.delete'))
      and exists (select 1 from public.occurrence_photo_files f where f.path = name and f.owner_id = (select auth.uid()) and f.state = 'cleanup' and f.cleanup_after <= now()))
  ));
create policy falaai_photos_select_linked on storage.objects
  for select to authenticated using (bucket_id = 'occurrence-photos' and (
    exists (select 1 from public.occurrences o where o.photo_path = name)
    or ((storage.allow_only_operation('storage.object.delete_many') or storage.allow_only_operation('storage.object.delete'))
      and exists (select 1 from public.occurrence_photo_files f where f.path = name and f.owner_id = (select auth.uid()) and f.state = 'cleanup' and f.cleanup_after <= now()))
  ));

create policy falaai_photos_delete_guard on storage.objects as restrictive
  for delete to authenticated using (bucket_id <> 'occurrence-photos' or (
    exists (select 1 from public.occurrence_photo_files f where f.path = name and f.owner_id = (select auth.uid()) and f.state = 'cleanup' and f.cleanup_after <= now())
    and not exists (select 1 from public.occurrences o where o.photo_path = name)
  ));
create policy falaai_photos_delete_own_cleanup on storage.objects
  for delete to authenticated using (bucket_id = 'occurrence-photos'
    and exists (select 1 from public.occurrence_photo_files f where f.path = name and f.owner_id = (select auth.uid()) and f.state = 'cleanup' and f.cleanup_after <= now())
    and not exists (select 1 from public.occurrences o where o.photo_path = name)
  );

commit;
