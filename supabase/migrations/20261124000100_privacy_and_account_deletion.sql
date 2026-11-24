-- LOCAL / NÃO APLICADA. Confirmar projeto e testar em ambiente descartável.
begin;
create table public.privacy_acceptances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  version text not null check (version = '2026-11-24-v1'),
  accepted_at timestamptz not null default now()
);
alter table public.privacy_acceptances enable row level security;
revoke all on public.privacy_acceptances from public, anon, authenticated;
grant select on public.privacy_acceptances to authenticated;
create policy privacy_read_own on public.privacy_acceptances for select to authenticated
  using (user_id = (select auth.uid()));
-- Sem backfill: contas existentes não forneceram este aceite.
create or replace function public.falaai_create_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.raw_user_meta_data ->> 'privacy_accepted' is distinct from 'true'
     or new.raw_user_meta_data ->> 'privacy_version' is distinct from '2026-11-24-v1' then
    raise exception 'Privacy acceptance required' using errcode = '23514';
  end if;
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), 'Participante'), 80));
  insert into public.privacy_acceptances(user_id, version) values (new.id, '2026-11-24-v1');
  return new;
end;
$$;
revoke all on function public.falaai_create_profile() from public, anon, authenticated;

-- Trabalho durável. Só o servidor pode criar/avançar; cliente lê apenas o próprio.
create table public.account_deletion_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  state text not null default 'cleaning' check (state in ('cleaning', 'ready'))
);
alter table public.account_deletion_requests enable row level security;
revoke all on public.account_deletion_requests from public, anon, authenticated;
grant select on public.account_deletion_requests to authenticated;
create policy deletion_read_own on public.account_deletion_requests for select to authenticated
  using (user_id = (select auth.uid()));

create function public.falaai_guard_deleting_account()
returns trigger language plpgsql security definer set search_path = '' as $$
declare owner_uuid uuid;
begin
  owner_uuid := coalesce((to_jsonb(new) ->> 'author_id')::uuid, (to_jsonb(new) ->> 'owner_id')::uuid);
  if exists(select 1 from public.account_deletion_requests where user_id = owner_uuid) then
    raise exception 'Account deletion in progress' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.falaai_guard_deleting_account() from public, anon, authenticated;
create trigger falaai_no_reports_during_deletion before insert or update on public.occurrences
  for each row execute function public.falaai_guard_deleting_account();
create trigger falaai_no_reservations_during_deletion before insert on public.occurrence_photo_files
  for each row execute function public.falaai_guard_deleting_account();
-- Não bloquear UPDATE do registro de limpeza: recuperação precisa continuar funcionando.
create policy falaai_no_upload_during_deletion on storage.objects as restrictive
  for insert to authenticated with check (
    bucket_id <> 'occurrence-photos' or not exists (
      select 1 from public.account_deletion_requests where user_id = (select auth.uid())
    )
  );

-- Helper privado: concluir apenas arquivos próprios, sem referência e cuja
-- ausência foi conferida em metadata. Permite retomar após Storage sem ACK.
create function public.falaai_prune_deleted_account_files(p_user uuid, p_paths text[] default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare removed integer;
begin
  delete from public.occurrence_photo_files f
  where f.owner_id = p_user
    and (p_paths is null or f.path = any(p_paths))
    and ((f.state = 'cleanup' and f.cleanup_after <= now())
      or (f.state in ('pending','uploaded') and f.created_at + interval '24 hours' <= now()))
    and not exists(select 1 from storage.objects o where o.bucket_id = 'occurrence-photos' and o.name = f.path)
    and not exists(select 1 from public.occurrences o where o.photo_path = f.path);
  get diagnostics removed = row_count;
  return removed;
end;
$$;
revoke all on function public.falaai_prune_deleted_account_files(uuid,text[]) from public, anon, authenticated, service_role;

-- RPC de ACK serializada pelo trabalho durável, idempotente para lotes repetidos.
create function public.ack_account_deletion_files(p_user uuid, p_paths text[])
returns integer language plpgsql security definer set search_path = '' as $$
begin
  if p_paths is null or cardinality(p_paths) > 100 or exists(
    select 1 from unnest(p_paths) as x(path) where path is null
      or split_part(path, '/', 1) <> p_user::text
      or path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
  ) then raise exception 'Invalid batch scope' using errcode = '42501'; end if;
  perform 1 from public.account_deletion_requests where user_id = p_user for update;
  if not found then return 0; end if;
  -- Prefixo isoladamente não basta: nunca remover registro de outro proprietário.
  if exists(select 1 from public.occurrence_photo_files where path = any(p_paths) and owner_id <> p_user) then
    raise exception 'Invalid batch owner' using errcode = '42501';
  end if;
  return public.falaai_prune_deleted_account_files(p_user, p_paths);
end;
$$;
revoke all on function public.ack_account_deletion_files(uuid,text[]) from public, anon, authenticated;
grant execute on function public.ack_account_deletion_files(uuid,text[]) to service_role;

-- Somente Edge Function com service_role, p_user derivado de getUser(token).
-- Nunca manipula storage.objects por DELETE SQL: somente consulta metadata.
create function public.prepare_account_deletion(p_user uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare paths jsonb; waiting boolean;
begin
  if not exists(select 1 from auth.users where id = p_user) then
    raise exception 'Unknown account';
  end if;
  insert into public.account_deletion_requests(user_id) values(p_user) on conflict do nothing;
  perform 1 from public.account_deletion_requests where user_id = p_user for update;
  -- O trigger existente transfere cada foto vinculada à fila na mesma transação.
  delete from public.occurrences where author_id = p_user;
  -- Upload com resposta perdida pode ainda estar em trânsito. Respeitar janela de 24h.
  select exists(select 1 from public.occurrence_photo_files where owner_id = p_user and (
    (state in ('pending','uploaded') and created_at + interval '24 hours' > now())
    or (state = 'cleanup' and cleanup_after > now())
  )) into waiting;
  if waiting then return jsonb_build_object('waiting', true, 'paths', '[]'::jsonb); end if;
  -- Canonicalidade + evidência de propriedade no registro criado antes do upload.
  if exists(select 1 from storage.objects o where o.bucket_id = 'occurrence-photos'
    and split_part(o.name, '/', 1) = p_user::text
    and not exists(select 1 from public.occurrence_photo_files f where f.path = o.name and f.owner_id = p_user)) then
    raise exception 'Unregistered storage object requires review';
  end if;
  -- Retomar inclusive quando o processo caiu depois de Storage e antes do ACK.
  perform public.falaai_prune_deleted_account_files(p_user);
  select coalesce(jsonb_agg(path), '[]'::jsonb) into paths from (
    select path from public.occurrence_photo_files where owner_id = p_user order by path limit 100
  ) batch;
  return jsonb_build_object('waiting', false, 'paths', paths);
end;
$$;

create function public.finish_account_deletion(p_user uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.account_deletion_requests where user_id = p_user for update;
  if not found then return false; end if;
  if exists(select 1 from public.occurrences where author_id = p_user)
     or exists(select 1 from storage.objects where
       (bucket_id = 'occurrence-photos' and split_part(name, '/', 1) = p_user::text)
       or owner_id = p_user::text)
     or exists(select 1 from public.occurrence_photo_files where owner_id = p_user and (
       (state in ('pending','uploaded') and created_at + interval '24 hours' > now())
       or (state = 'cleanup' and cleanup_after > now())
     )) then return false; end if;
  perform public.falaai_prune_deleted_account_files(p_user);
  if exists(select 1 from public.occurrence_photo_files where owner_id = p_user) then return false; end if;
  update public.account_deletion_requests set state = 'ready' where user_id = p_user;
  return true;
end;
$$;
revoke all on function public.prepare_account_deletion(uuid) from public, anon, authenticated;
revoke all on function public.finish_account_deletion(uuid) from public, anon, authenticated;
grant execute on function public.prepare_account_deletion(uuid) to service_role;
grant execute on function public.finish_account_deletion(uuid) to service_role;
commit;
