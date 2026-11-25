-- VERIFY ONLY / SOMENTE LEITURA / PÓS-MIGRAÇÃO LGPD 003.
-- Executar integralmente em consulta NOVA do SQL Editor de falaai-lgpd-validacao.
-- NÃO É MIGRAÇÃO. Nenhuma RPC do aplicativo é executada.
-- Uma grade: PASSOU/FALHOU + detalhes. Falha/NULL exige interrupção.
-- Fontes esperadas: migrações locais 001, 002 e 003 revisadas em 25/11/2026.
-- query_to_xml recebe somente SELECTs fixos; não recebe entrada externa.
with expected_functions(signature,result,definer,body) as (values
('public.falaai_create_profile()','trigger',true,$body$
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
$body$),
('public.falaai_touch_occurrence()','trigger',false,$body$
begin
  new.updated_at = now();
  return new;
end;
$body$),
('public.reserve_occurrence_photo(text)','text',true,$body$
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
$body$),
('public.confirm_occurrence_photo_upload(text)','boolean',true,$body$
begin
  update public.occurrence_photo_files f set state = 'uploaded'
  where f.path = p_path and f.owner_id = auth.uid() and f.state = 'pending'
    and exists (select 1 from storage.objects where bucket_id = 'occurrence-photos' and name = p_path);
  return found;
end;
$body$),
('public.abandon_occurrence_photo(text)','boolean',true,$body$
begin
  -- Se o insert/update foi confirmado mas sua resposta se perdeu, state=linked
  -- impede apagar a imagem já vinculada. Falha de rede não vira rollback cego.
  update public.occurrence_photo_files set state = 'cleanup',
    cleanup_after = case when state = 'pending' then now() + interval '24 hours' else now() end
  where path = p_path and owner_id = auth.uid() and state in ('pending','uploaded')
    and not exists (select 1 from public.occurrences where photo_path = p_path);
  return found;
end;
$body$),
('public.claim_occurrence_photo_cleanup()','SETOF text',true,$body$
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
$body$),
('public.finish_occurrence_photo_cleanup(text)','boolean',true,$body$
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
$body$),
('public.falaai_link_occurrence_photo()','trigger',true,$body$
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
$body$),
('public.falaai_queue_deleted_photo()','trigger',true,$body$
begin
  if old.photo_path is not null then
    update public.occurrence_photo_files set state = 'cleanup', cleanup_after = now()
      where path = old.photo_path and owner_id = old.author_id;
    if not found then raise exception 'Registro de recuperação ausente; exclusão cancelada'; end if;
  end if;
  return old;
end;
$body$),
('public.falaai_guard_deleting_account()','trigger',true,$body$
declare owner_uuid uuid;
begin
  owner_uuid := coalesce((to_jsonb(new) ->> 'author_id')::uuid, (to_jsonb(new) ->> 'owner_id')::uuid);
  if exists(select 1 from public.account_deletion_requests where user_id = owner_uuid) then
    raise exception 'Account deletion in progress' using errcode = '42501';
  end if;
  return new;
end;
$body$),
('public.falaai_prune_deleted_account_files(uuid,text[])','integer',true,$body$
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
$body$),
('public.ack_account_deletion_files(uuid,text[])','integer',true,$body$
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
$body$),
('public.prepare_account_deletion(uuid)','jsonb',true,$body$
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
$body$),
('public.finish_account_deletion(uuid)','boolean',true,$body$
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
$body$)
), function_inventory as (
 select e.*,p.oid,p.prosrc,p.prosecdef,p.proconfig,p.proowner,
 pg_catalog.pg_get_function_result(p.oid) as actual_result,l.lanname
 from expected_functions e left join pg_catalog.pg_proc p on p.oid=pg_catalog.to_regprocedure(e.signature)
 left join pg_catalog.pg_language l on l.oid=p.prolang
), expected_tables(table_name) as (values
 ('public.profiles'),('public.occurrences'),('public.occurrence_photo_files'),
 ('public.privacy_acceptances'),('public.account_deletion_requests'),('storage.objects')
), expected_columns(table_name,column_name,type_name,not_null) as (values
 ('public.privacy_acceptances','user_id','uuid',true),
 ('public.privacy_acceptances','version','text',true),
 ('public.privacy_acceptances','accepted_at','timestamp with time zone',true),
 ('public.account_deletion_requests','user_id','uuid',true),
 ('public.account_deletion_requests','requested_at','timestamp with time zone',true),
 ('public.account_deletion_requests','state','text',true)
), expected_triggers(table_name,trigger_name,function_name,type_bits) as (values
 ('auth.users','falaai_auth_user_created','falaai_create_profile',5),
 ('public.occurrences','falaai_occurrence_updated','falaai_touch_occurrence',19),
 ('public.occurrences','falaai_link_occurrence_photo','falaai_link_occurrence_photo',23),
 ('public.occurrences','falaai_queue_deleted_photo','falaai_queue_deleted_photo',9),
 ('public.occurrences','falaai_no_reports_during_deletion','falaai_guard_deleting_account',23),
 ('public.occurrence_photo_files','falaai_no_reservations_during_deletion','falaai_guard_deleting_account',7)
), expected_policies(schema_name,table_name,policy_name,mode,cmd,role_name) as (values
 ('public','profiles','profiles_select_own','PERMISSIVE','SELECT','authenticated'),
 ('public','profiles','profiles_update_own','PERMISSIVE','UPDATE','authenticated'),
 ('public','occurrences','occurrences_select_community','PERMISSIVE','SELECT','authenticated'),
 ('public','occurrences','occurrences_insert_own','PERMISSIVE','INSERT','authenticated'),
 ('public','occurrences','occurrences_update_own','PERMISSIVE','UPDATE','authenticated'),
 ('public','occurrences','occurrences_delete_own','PERMISSIVE','DELETE','authenticated'),
 ('public','occurrence_photo_files','occurrence_photo_files_select_own','PERMISSIVE','SELECT','authenticated'),
 ('public','privacy_acceptances','privacy_read_own','PERMISSIVE','SELECT','authenticated'),
 ('public','account_deletion_requests','deletion_read_own','PERMISSIVE','SELECT','authenticated'),
 ('storage','objects','falaai_photos_anon_guard','RESTRICTIVE','ALL','anon'),
 ('storage','objects','falaai_photos_insert_guard','RESTRICTIVE','INSERT','authenticated'),
 ('storage','objects','falaai_photos_insert_own','PERMISSIVE','INSERT','authenticated'),
 ('storage','objects','falaai_photos_update_guard','RESTRICTIVE','UPDATE','authenticated'),
 ('storage','objects','falaai_photos_select_guard','RESTRICTIVE','SELECT','authenticated'),
 ('storage','objects','falaai_photos_select_linked','PERMISSIVE','SELECT','authenticated'),
 ('storage','objects','falaai_photos_delete_guard','RESTRICTIVE','DELETE','authenticated'),
 ('storage','objects','falaai_photos_delete_own_cleanup','PERMISSIVE','DELETE','authenticated'),
 ('storage','objects','falaai_no_upload_during_deletion','RESTRICTIVE','INSERT','authenticated')
), roles(role_name) as (values ('anon'),('authenticated'),('service_role')),
-- Counts: existence guards prevent early resolution of missing application tables.
count_sources(table_name,query) as (values
 ('auth.users','select count(*) as total from auth.users'),
 ('public.profiles','select count(*) as total from public.profiles'),
 ('public.occurrences','select count(*) as total from public.occurrences'),
 ('public.occurrence_photo_files','select count(*) as total from public.occurrence_photo_files'),
 ('public.privacy_acceptances','select count(*) as total from public.privacy_acceptances'),
 ('public.account_deletion_requests','select count(*) as total from public.account_deletion_requests'),
 ('storage.objects','select count(*) as total from storage.objects')
), counts as (
 select table_name,case when pg_catalog.to_regclass(table_name) is not null then
 ((pg_catalog.xpath('/table/row/total/text()',pg_catalog.query_to_xml(query,false,false,'')))[1]::text)::bigint end as total
 from count_sources
), checks(id,ok,details) as (
 select 'A tabela/RLS '||e.table_name,c.oid is not null and c.relkind='r' and c.relrowsecurity,
 'exists='||(c.oid is not null)::text||'; RLS='||coalesce(c.relrowsecurity::text,'NULL')
 from expected_tables e left join pg_catalog.pg_class c on c.oid=pg_catalog.to_regclass(e.table_name)
 union all
 select 'B coluna '||e.table_name||'.'||e.column_name,
 a.attnum is not null and pg_catalog.format_type(a.atttypid,a.atttypmod)=e.type_name and a.attnotnull=e.not_null,
 'tipo='||coalesce(pg_catalog.format_type(a.atttypid,a.atttypmod),'NULL')||'; not_null='||coalesce(a.attnotnull::text,'NULL')
 from expected_columns e left join pg_catalog.pg_attribute a
 on a.attrelid=pg_catalog.to_regclass(e.table_name) and a.attname=e.column_name and a.attnum>0 and not a.attisdropped
 union all
 select 'C função/corpo '||signature,oid is not null and prosrc=body and actual_result=result
 and prosecdef=definer and lanname='plpgsql' and proconfig=array['search_path=""'],
 'presente='||(oid is not null)::text||'; corpo_exato='||coalesce((prosrc=body)::text,'NULL')||
 '; retorno='||coalesce(actual_result,'NULL')||'; definer='||coalesce(prosecdef::text,'NULL')||
 '; search_path='||coalesce(proconfig::text,'NULL')
 from function_inventory
 union all
 select 'D EXECUTE '||f.signature||' / '||roles.role_name,
 p.oid is not null and r.oid is not null and pg_catalog.has_function_privilege(r.oid,p.oid,'EXECUTE')=
 case when roles.role_name='authenticated' then f.signature in (
 'public.reserve_occurrence_photo(text)','public.confirm_occurrence_photo_upload(text)',
 'public.abandon_occurrence_photo(text)','public.claim_occurrence_photo_cleanup()',
 'public.finish_occurrence_photo_cleanup(text)')
 when roles.role_name='service_role' then case
 when f.signature='public.falaai_prune_deleted_account_files(uuid,text[])' then false
 else pg_catalog.has_function_privilege(r.oid,p.oid,'EXECUTE') end
 else false end,
 'execute='||coalesce(pg_catalog.has_function_privilege(r.oid,p.oid,'EXECUTE')::text,'NULL')||
 case when roles.role_name='service_role' and f.signature not in ('public.prepare_account_deletion(uuid)',
 'public.ack_account_deletion_files(uuid,text[])','public.finish_account_deletion(uuid)',
 'public.falaai_prune_deleted_account_files(uuid,text[])') then '; informativo para esta função' else '' end
 from expected_functions f cross join roles
 left join pg_catalog.pg_proc p on p.oid=pg_catalog.to_regprocedure(f.signature)
 left join pg_catalog.pg_roles r on r.rolname=roles.role_name
 union all
 select 'D2 RPC administrativa '||f.signature,
 p.oid is not null and r.oid is not null and pg_catalog.has_function_privilege(r.oid,p.oid,'EXECUTE'),
 'service_role deve ter EXECUTE'
 from (values ('public.prepare_account_deletion(uuid)'),('public.ack_account_deletion_files(uuid,text[])'),
 ('public.finish_account_deletion(uuid)')) f(signature)
 left join pg_catalog.pg_proc p on p.oid=pg_catalog.to_regprocedure(f.signature)
 left join pg_catalog.pg_roles r on r.rolname='service_role'
 union all
 select 'E trigger '||e.trigger_name,t.oid is not null and t.tgenabled in ('O','A')
 and t.tgtype=e.type_bits and t.tgfoid=pg_catalog.to_regprocedure('public.'||e.function_name||'()')
 and case when e.trigger_name='falaai_link_occurrence_photo' then t.tgattr::text=
 (select a.attnum::text from pg_catalog.pg_attribute a where a.attrelid=t.tgrelid and a.attname='photo_path' and not a.attisdropped)
 else t.tgattr::text='' end,
 coalesce(pg_catalog.pg_get_triggerdef(t.oid,true),'AUSENTE')
 from expected_triggers e left join pg_catalog.pg_trigger t on t.tgrelid=pg_catalog.to_regclass(e.table_name)
 and t.tgname=e.trigger_name and not t.tgisinternal
 union all
 select 'F política '||e.policy_name,p.policyname is not null and p.permissive=e.mode and p.cmd=e.cmd
 and p.roles=array[e.role_name::name],
 'USING='||coalesce(p.qual,'NULL')||'; CHECK='||coalesce(p.with_check,'NULL')
 from expected_policies e left join pg_catalog.pg_policies p on p.schemaname=e.schema_name
 and p.tablename=e.table_name and p.policyname=e.policy_name
 union all
 select 'F2 políticas adicionais',not exists(
 select 1 from pg_catalog.pg_policies p where ((p.schemaname='public' and p.tablename in
 ('profiles','occurrences','occurrence_photo_files','privacy_acceptances','account_deletion_requests'))
 or (p.schemaname='storage' and p.tablename='objects'))
 and not exists(select 1 from expected_policies e where e.schema_name=p.schemaname and e.table_name=p.tablename and e.policy_name=p.policyname)),
 'Esperadas 18 políticas nas cinco tabelas public e storage.objects; conferir expressões F.'
 union all
 select 'G tabela privilégios '||e.table_name||' / '||roles.role_name,
 c.oid is not null and r.oid is not null
 and pg_catalog.has_table_privilege(r.oid,c.oid,'SELECT')=(roles.role_name='authenticated')
 and not pg_catalog.has_table_privilege(r.oid,c.oid,'INSERT')
 and not pg_catalog.has_table_privilege(r.oid,c.oid,'UPDATE')
 and not pg_catalog.has_table_privilege(r.oid,c.oid,'DELETE')
 and not pg_catalog.has_table_privilege(r.oid,c.oid,'TRUNCATE')
 and not exists(select 1 from pg_catalog.pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
 and (pg_catalog.has_column_privilege(r.oid,c.oid,a.attnum::smallint,'INSERT')
 or pg_catalog.has_column_privilege(r.oid,c.oid,a.attnum::smallint,'UPDATE')
 or pg_catalog.has_column_privilege(r.oid,c.oid,a.attnum::smallint,'REFERENCES'))),
 'authenticated: somente SELECT; anon: nenhum acesso; nenhuma escrita por coluna'
 from (values ('public.privacy_acceptances'),('public.account_deletion_requests'),('public.occurrence_photo_files')) e(table_name)
 cross join roles left join pg_catalog.pg_roles r on r.rolname=roles.role_name
 left join pg_catalog.pg_class c on c.oid=pg_catalog.to_regclass(e.table_name)
 where roles.role_name in ('anon','authenticated')
 union all
 select 'H vazio '||table_name,total=0,'total='||coalesce(total::text,'NULL / tabela ausente') from counts
 union all
 select 'I FK '||e.table_name,
 (select count(*)=1 and bool_and(con.confdeltype=e.delete_code::"char" and con.confrelid=pg_catalog.to_regclass('auth.users') and con.convalidated)
 from pg_catalog.pg_constraint con where con.conrelid=pg_catalog.to_regclass(e.table_name) and con.contype='f'),
 coalesce((select string_agg(pg_catalog.pg_get_constraintdef(con.oid,true),'; ') from pg_catalog.pg_constraint con
 where con.conrelid=pg_catalog.to_regclass(e.table_name) and con.contype='f'),'AUSENTE')
 from (values ('public.privacy_acceptances','c'),('public.account_deletion_requests','c'),('public.occurrence_photo_files','r')) e(table_name,delete_code)
 union all
 select 'I2 restrições '||e.table_name,
 (select count(*)=3 and count(*) filter(where con.contype='p')=1 and count(*) filter(where con.contype='f')=1
 and count(*) filter(where con.contype='c')=1 and bool_and(con.convalidated)
 from pg_catalog.pg_constraint con where con.conrelid=pg_catalog.to_regclass(e.table_name)),
 coalesce((select string_agg(pg_catalog.pg_get_constraintdef(con.oid,true),'; ') from pg_catalog.pg_constraint con
 where con.conrelid=pg_catalog.to_regclass(e.table_name)),'AUSENTE')
 from (values ('public.privacy_acceptances'),('public.account_deletion_requests')) e(table_name)
 union all
 select 'I3 default '||e.table_name||'.'||e.column_name,pg_catalog.pg_get_expr(d.adbin,d.adrelid)=e.expected_default,
 coalesce(pg_catalog.pg_get_expr(d.adbin,d.adrelid),'NULL')
 from (values ('public.privacy_acceptances','accepted_at','now()'),
 ('public.account_deletion_requests','requested_at','now()'),
 ('public.account_deletion_requests','state',quote_literal('cleaning')||'::text')) e(table_name,column_name,expected_default)
 left join pg_catalog.pg_attribute a on a.attrelid=pg_catalog.to_regclass(e.table_name) and a.attname=e.column_name and not a.attisdropped
 left join pg_catalog.pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
 union all
 select 'I4 índice '||e.index_name,i.indexrelid is not null and i.indisvalid and i.indisready and i.indisunique=e.unique_expected,
 coalesce(pg_catalog.pg_get_indexdef(i.indexrelid),'AUSENTE')
 from (values ('public.occurrence_photo_files_cleanup_idx',false),('public.occurrences_unique_photo_path',true),
 ('public.privacy_acceptances_pkey',true),('public.account_deletion_requests_pkey',true)) e(index_name,unique_expected)
 left join pg_catalog.pg_index i on i.indexrelid=pg_catalog.to_regclass(e.index_name)
 union all
 select 'J bucket e Storage',case when (select count(*)=5 from pg_catalog.pg_attribute a
 where a.attrelid=pg_catalog.to_regclass('storage.buckets') and not a.attisdropped and a.attnum>0
 and a.attname in ('id','name','public','file_size_limit','allowed_mime_types')) then
 ((pg_catalog.xpath('/table/row/ok/text()',pg_catalog.query_to_xml(
 $read$select count(*)=1 and bool_and(name='occurrence-photos' and public=false and file_size_limit=5242880
 and allowed_mime_types @> array['image/jpeg','image/png','image/webp']::text[]
 and allowed_mime_types <@ array['image/jpeg','image/png','image/webp']::text[] and cardinality(allowed_mime_types)=3) as ok
 from storage.buckets where id='occurrence-photos'$read$,false,false,'')))[1]::text)::boolean else false end
 and pg_catalog.to_regprocedure('storage.allow_only_operation(text)') is not null,
 'Bucket occurrence-photos privado; 5242880 bytes; 3 MIME exatos; helper Storage presente'
 union all
 select 'J2 grants Storage authenticated',c.oid is not null and r.oid is not null
 and pg_catalog.has_table_privilege(r.oid,c.oid,'SELECT')
 and pg_catalog.has_table_privilege(r.oid,c.oid,'INSERT')
 and pg_catalog.has_table_privilege(r.oid,c.oid,'DELETE'),
 'Preservados SELECT/INSERT/DELETE globais; RLS limita o bucket'
 from (values (1)) v(x) left join pg_catalog.pg_class c on c.oid=pg_catalog.to_regclass('storage.objects')
 left join pg_catalog.pg_roles r on r.rolname='authenticated'
 union all
 select 'K tabela public extra',not exists(select 1 from pg_catalog.pg_class c
 join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
 and c.relkind in ('r','p','v','m','f') and c.relname not in ('profiles','occurrences','occurrence_photo_files','privacy_acceptances','account_deletion_requests')),
 'Esperadas somente cinco tabelas do aplicativo; objetos extras exigem revisão, não exclusão'
 union all
 select 'K2 funções extras/sobrecargas',not exists(select 1 from pg_catalog.pg_proc p
 join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
 and (p.proname like 'falaai!_%' escape '!' or p.proname like '%occurrence_photo%' or p.proname like '%account_deletion%')
 and not exists(select 1 from expected_functions e where p.oid=pg_catalog.to_regprocedure(e.signature))),
 'Nenhuma função adicional dos namespaces do aplicativo'
 union all
 select 'L corpo CHECK privacidade',
 exists(select 1 from pg_catalog.pg_constraint con where con.conrelid=pg_catalog.to_regclass('public.privacy_acceptances') and con.contype='c'
 and pg_catalog.regexp_replace(pg_catalog.pg_get_expr(con.conbin,con.conrelid),'[[:space:]()]','','g')=
 'version='||quote_literal('2026-11-24-v1')||'::text'),
 'CHECK version deve ser exatamente 2026-11-24-v1'
 union all
 select 'L2 expressão leitura '||e.policy_name,
 p.with_check is null and pg_catalog.regexp_replace(pg_catalog.regexp_replace(lower(p.qual),'[[:space:]()]','','g'),'asuid','','g')='user_id=selectauth.uid',
 coalesce(p.qual,'AUSENTE')
 from (values ('privacy_read_own'),('deletion_read_own')) e(policy_name)
 left join pg_catalog.pg_policies p on p.schemaname='public' and p.policyname=e.policy_name
 union all
 select 'L3 expressão bloqueio upload',p.qual is null and
 pg_catalog.regexp_replace(pg_catalog.regexp_replace(pg_catalog.regexp_replace(lower(p.with_check),'public\.','','g'),'[[:space:]()]','','g'),'asuid','','g')=
 'bucket_id<>'||quote_literal('occurrence-photos')||'::textornotexistsselect1fromaccount_deletion_requestswhereaccount_deletion_requests.user_id=selectauth.uid',
 coalesce(p.with_check,'AUSENTE')||'; Diferença de formato exige revisão, não ampliar a política'
 from (values(1)) v(x) left join pg_catalog.pg_policies p on p.schemaname='storage' and p.tablename='objects' and p.policyname='falaai_no_upload_during_deletion'

 union all
 select 'L4 CHECK estado de exclusão',exists(select 1 from pg_catalog.pg_constraint con
 where con.conrelid=pg_catalog.to_regclass('public.account_deletion_requests') and con.contype='c'
 and pg_catalog.regexp_replace(pg_catalog.pg_get_expr(con.conbin,con.conrelid),'[[:space:]()]','','g')=
 'state=ANYARRAY['||quote_literal('cleaning')||'::text,'||quote_literal('ready')||'::text]'),
 coalesce((select string_agg(pg_catalog.pg_get_expr(con.conbin,con.conrelid),'; ') from pg_catalog.pg_constraint con
 where con.conrelid=pg_catalog.to_regclass('public.account_deletion_requests') and con.contype='c'),'AUSENTE')
 union all
 select 'L5 PK/FK user_id '||e.table_name,
 exists(select 1 from pg_catalog.pg_constraint con
 where con.conrelid=pg_catalog.to_regclass(e.table_name) and con.contype='p'
 and con.conkey=array[a.attnum])
 and exists(select 1 from pg_catalog.pg_constraint con
 where con.conrelid=pg_catalog.to_regclass(e.table_name) and con.contype='f'
 and con.conkey=array[a.attnum] and con.confrelid=pg_catalog.to_regclass('auth.users')
 and con.confkey=array[u.attnum]),
 'PK(user_id), FK(user_id)->auth.users(id)'
 from (values ('public.privacy_acceptances'),('public.account_deletion_requests')) e(table_name)
 left join pg_catalog.pg_attribute a on a.attrelid=pg_catalog.to_regclass(e.table_name) and a.attname='user_id' and not a.attisdropped
 left join pg_catalog.pg_attribute u on u.attrelid=pg_catalog.to_regclass('auth.users') and u.attname='id' and not u.attisdropped
)
select id as verificacao,case when coalesce(ok,false) then 'PASSOU' else 'FALHOU' end as resultado,
 details as detalhes from checks order by id;
