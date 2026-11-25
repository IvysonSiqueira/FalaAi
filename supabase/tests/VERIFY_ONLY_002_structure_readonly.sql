-- VERIFICADOR PÓS-MIGRAÇÃO 002 — SOMENTE LEITURA — NÃO É MIGRAÇÃO.
-- Destino manual exclusivo: falaai-lgpd-validacao. Não executar no projeto principal.
-- Execute cada bloco A–K individualmente. SELECTs de catálogo e contagens.
-- H e K usam query_to_xml apenas com SELECTs constantes, nunca SQL recebido externamente.
-- Não chama RPCs, triggers, storage.allow_only_operation ou funções do aplicativo.
-- Objetos ausentes geram false/NULL/zero linhas; não use casts literais ::regclass.

-- A — Tabelas, RLS e dependências. Esperado: 5 linhas, exists_ok=true;
-- RLS true nas tabelas public e storage.objects (auth.users não é avaliada).
with expected(schema_name,table_name) as (values
 ('public','profiles'),('public','occurrences'),('public','occurrence_photo_files'),
 ('storage','objects'),('storage','buckets'))
select e.*, c.oid is not null as exists_ok, c.relkind, c.relrowsecurity,
 pg_catalog.pg_get_userbyid(c.relowner) as owner
from expected e left join pg_catalog.pg_namespace n on n.nspname=e.schema_name
left join pg_catalog.pg_class c on c.relnamespace=n.oid and c.relname=e.table_name
order by e.schema_name,e.table_name;

-- B — Colunas: registro tem path, owner_id, state, created_at, cleanup_after;
-- occurrences mantém author_id UUID e photo_path text; Storage fornece as colunas usadas pela LGPD.
with expected(schema_name,table_name,column_name) as (values
 ('public','occurrence_photo_files','path'),('public','occurrence_photo_files','owner_id'),
 ('public','occurrence_photo_files','state'),('public','occurrence_photo_files','created_at'),
 ('public','occurrence_photo_files','cleanup_after'),('public','occurrences','author_id'),
 ('public','occurrences','photo_path'),('storage','objects','bucket_id'),
 ('storage','objects','name'),('storage','objects','owner_id'),('auth','users','id'))
select e.*, a.attnum is not null as exists_ok,
 pg_catalog.format_type(a.atttypid,a.atttypmod) as data_type, a.attnotnull,
 pg_catalog.pg_get_expr(d.adbin,d.adrelid) as default_expression
from expected e left join pg_catalog.pg_namespace n on n.nspname=e.schema_name
left join pg_catalog.pg_class c on c.relnamespace=n.oid and c.relname=e.table_name
left join pg_catalog.pg_attribute a on a.attrelid=c.oid and a.attname=e.column_name
 and a.attnum>0 and not a.attisdropped
left join pg_catalog.pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum
order by e.schema_name,e.table_name,e.column_name;

-- C — Restrições e índices. Registro: PK(path), FK(owner_id)->auth.users RESTRICT,
-- CHECK de estados e CHECK de caminho/UUID proprietário (4 restrições).
-- Índices: PK do registro, cleanup(owner_id,state,created_at), unique photo_path parcial.
select con.conname, con.contype, con.confdeltype,
 pg_catalog.pg_get_constraintdef(con.oid,true) as definition
from pg_catalog.pg_constraint con
where con.conrelid=pg_catalog.to_regclass('public.occurrence_photo_files')
order by con.conname;

select schemaname,tablename,indexname,indexdef
from pg_catalog.pg_indexes
where (schemaname='public' and tablename='occurrence_photo_files')
 or (schemaname='public' and indexname='occurrences_unique_photo_path')
order by tablename,indexname;

-- D — RPCs e funções de trigger: 7 linhas, exists_ok=true, SECURITY DEFINER,
-- language=plpgsql e proconfig contendo search_path="". Conferir corpo com a migração.
with expected(signature,expected_result) as (values
 ('public.reserve_occurrence_photo(text)','text'),
 ('public.confirm_occurrence_photo_upload(text)','boolean'),
 ('public.abandon_occurrence_photo(text)','boolean'),
 ('public.claim_occurrence_photo_cleanup()','SETOF text'),
 ('public.finish_occurrence_photo_cleanup(text)','boolean'),
 ('public.falaai_link_occurrence_photo()','trigger'),
 ('public.falaai_queue_deleted_photo()','trigger'))
select e.*, p.oid is not null as exists_ok,
 pg_catalog.pg_get_function_result(p.oid) as actual_result,
 p.prosecdef as security_definer,p.proconfig,l.lanname as language,
 pg_catalog.pg_get_userbyid(p.proowner) as owner,p.prosrc as function_body
from expected e left join pg_catalog.pg_proc p on p.oid=pg_catalog.to_regprocedure(e.signature)
left join pg_catalog.pg_language l on l.oid=p.prolang
order by e.signature;

-- E — Dois triggers esperados em occurrences, habilitados O (ou A),
-- vínculo BEFORE INSERT/UPDATE OF photo_path; fila AFTER DELETE.
with expected(trigger_name) as (values ('falaai_link_occurrence_photo'),('falaai_queue_deleted_photo'))
select e.trigger_name,t.oid is not null as exists_ok,t.tgenabled,
 pg_catalog.pg_get_triggerdef(t.oid,true) as definition,
 n.nspname as function_schema,p.proname as function_name
from expected e left join pg_catalog.pg_trigger t
 on t.tgrelid=pg_catalog.to_regclass('public.occurrences')
 and t.tgname=e.trigger_name and not t.tgisinternal
left join pg_catalog.pg_proc p on p.oid=t.tgfoid
left join pg_catalog.pg_namespace n on n.oid=p.pronamespace
order by e.trigger_name;

-- F — Oito políticas Storage: nomes, papéis, comando, modo e expressões reais.
-- expected_match confere metadados; expressões exigem revisão com a migração 002.
with expected(policy_name,expected_mode,expected_cmd,expected_role) as (values
 ('falaai_photos_anon_guard','RESTRICTIVE','ALL','anon'),
 ('falaai_photos_insert_guard','RESTRICTIVE','INSERT','authenticated'),
 ('falaai_photos_insert_own','PERMISSIVE','INSERT','authenticated'),
 ('falaai_photos_update_guard','RESTRICTIVE','UPDATE','authenticated'),
 ('falaai_photos_select_guard','RESTRICTIVE','SELECT','authenticated'),
 ('falaai_photos_select_linked','PERMISSIVE','SELECT','authenticated'),
 ('falaai_photos_delete_guard','RESTRICTIVE','DELETE','authenticated'),
 ('falaai_photos_delete_own_cleanup','PERMISSIVE','DELETE','authenticated'))
select e.*,p.policyname is not null as exists_ok,p.permissive,p.cmd,p.roles,p.qual,p.with_check,
 coalesce(p.permissive=e.expected_mode and p.cmd=e.expected_cmd
 and p.roles=array[e.expected_role::name],false) as expected_match
from expected e left join pg_catalog.pg_policies p
 on p.schemaname='storage' and p.tablename='objects' and p.policyname=e.policy_name
order by e.policy_name;

-- Política própria do registro: uma linha, authenticated SELECT, owner_id=auth.uid().
select policyname,permissive,cmd,roles,qual,with_check from pg_catalog.pg_policies
where schemaname='public' and tablename='occurrence_photo_files' order by policyname;

-- G — Privilégios efetivos de tabela (incluem herança/PUBLIC).
-- Registro: anon nenhum; authenticated somente SELECT (privilégios de coluna em G2).
-- Storage authenticated SELECT/INSERT/DELETE=true; UPDATE pode existir globalmente,
-- mas a política restritiva impede UPDATE neste bucket. Não alterar grants globais.
with expected(table_name,role_name) as (values
 ('public.occurrence_photo_files','anon'),('public.occurrence_photo_files','authenticated'),
 ('storage.objects','anon'),('storage.objects','authenticated'))
select e.*,c.oid is not null as table_exists,r.oid is not null as role_exists,
 case when c.oid is not null and r.oid is not null then pg_catalog.has_table_privilege(r.oid,c.oid,'SELECT') end as can_select,
 case when c.oid is not null and r.oid is not null then pg_catalog.has_table_privilege(r.oid,c.oid,'INSERT') end as can_insert,
 case when c.oid is not null and r.oid is not null then pg_catalog.has_table_privilege(r.oid,c.oid,'UPDATE') end as can_update,
 case when c.oid is not null and r.oid is not null then pg_catalog.has_table_privilege(r.oid,c.oid,'DELETE') end as can_delete,
 case when c.oid is not null and r.oid is not null then pg_catalog.has_table_privilege(r.oid,c.oid,'TRUNCATE') end as can_truncate
from expected e left join pg_catalog.pg_class c on c.oid=pg_catalog.to_regclass(e.table_name)
left join pg_catalog.pg_roles r on r.rolname=e.role_name order by e.table_name,e.role_name;

-- G2 — Grants explicitos, inclusive PUBLIC e privilégios por coluna.
-- Registro: ACL de authenticated SELECT, nenhum grant de escrita de coluna.
select n.nspname,c.relname,case when acl.grantee=0 then 'PUBLIC' else r.rolname::text end as grantee,
 acl.privilege_type,acl.is_grantable
from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
cross join lateral pg_catalog.aclexplode(coalesce(c.relacl,pg_catalog.acldefault('r',c.relowner))) acl
left join pg_catalog.pg_roles r on r.oid=acl.grantee
where c.oid=pg_catalog.to_regclass('public.occurrence_photo_files')
order by grantee,acl.privilege_type;

select n.nspname,c.relname,a.attname,
 case when acl.grantee=0 then 'PUBLIC' else r.rolname::text end as grantee,
 acl.privilege_type,acl.is_grantable
from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
join pg_catalog.pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
cross join lateral pg_catalog.aclexplode(a.attacl) acl
left join pg_catalog.pg_roles r on r.oid=acl.grantee
where c.oid in (pg_catalog.to_regclass('public.occurrence_photo_files'),pg_catalog.to_regclass('public.occurrences'))
order by c.relname,a.attname,grantee,acl.privilege_type;

-- G3 — EXECUTE efetivo: anon=false para todas; authenticated=true só nas 5 RPCs.
-- service_role apenas informativo: 002 não redefine todos os grants herdados desse papel.
with expected(signature) as (values
 ('public.reserve_occurrence_photo(text)'),('public.confirm_occurrence_photo_upload(text)'),('public.abandon_occurrence_photo(text)'),('public.claim_occurrence_photo_cleanup()'),('public.finish_occurrence_photo_cleanup(text)'),('public.falaai_link_occurrence_photo()'),('public.falaai_queue_deleted_photo()')), roles(role_name) as (values ('anon'),('authenticated'),('service_role'))
select e.signature,roles.role_name,p.oid is not null as function_exists,
 case when p.oid is not null and r.oid is not null then pg_catalog.has_function_privilege(r.oid,p.oid,'EXECUTE') end as can_execute
from expected e cross join roles
left join pg_catalog.pg_proc p on p.oid=pg_catalog.to_regprocedure(e.signature)
left join pg_catalog.pg_roles r on r.rolname=roles.role_name order by e.signature,roles.role_name;

-- H — Bucket: SELECT constante via query_to_xml, protegido por existência das
-- colunas. Evita resolução antecipada de uma tabela ausente. Não executa RPC.
-- Esperado: 1 bucket, public=false, limite=5242880, 3 MIME exatos;
-- private_ok, size_ok e mime_ok true. Se faltar estrutura: ready=false, XML NULL.
with readiness as (
 select count(*)=5 as ready from pg_catalog.pg_attribute a
 where a.attrelid=pg_catalog.to_regclass('storage.buckets') and a.attnum>0 and not a.attisdropped
 and a.attname in ('id','name','public','file_size_limit','allowed_mime_types')
)
select ready,case when ready then pg_catalog.query_to_xml(
 $readonly$select id,name,public,file_size_limit,allowed_mime_types,
 public is false as private_ok,coalesce(file_size_limit=5242880,false) as size_ok,
 coalesce(allowed_mime_types @> array['image/jpeg','image/png','image/webp']::text[]
 and allowed_mime_types <@ array['image/jpeg','image/png','image/webp']::text[]
 and cardinality(allowed_mime_types)=3,false) as mime_ok
 from storage.buckets where id='occurrence-photos'$readonly$,
 false,false,'') end as bucket_result_xml from readiness;

-- I — Inventário de objetos extras: revisar diferenças; não apagar nada.
-- Esperado: 3 tabelas public (profiles, occurrences, occurrence_photo_files).
select c.relname,c.relkind from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('r','p','v','m','f') order by c.relname;

-- Todas as políticas Storage (esperado somente as 8 acima no ambiente novo).
select policyname,permissive,roles,cmd,qual,with_check from pg_catalog.pg_policies
where schemaname='storage' and tablename='objects' order by policyname;

-- Funções e triggers public para detectar sobrecargas/triggers adicionais.
select p.proname,pg_catalog.pg_get_function_identity_arguments(p.oid) as arguments,
 p.prokind from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and (p.proname like '%occurrence_photo%' or p.proname like 'falaai_%') order by p.proname,arguments;
select c.relname,t.tgname,pg_catalog.pg_get_triggerdef(t.oid,true) as definition
from pg_catalog.pg_trigger t join pg_catalog.pg_class c on c.oid=t.tgrelid
join pg_catalog.pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and not t.tgisinternal order by c.relname,t.tgname;

-- J — Pré-LGPD: estes objetos devem estar AUSENTES (false) antes da migração 003.
select pg_catalog.to_regclass('public.privacy_acceptances') is not null as privacy_already_exists,
 pg_catalog.to_regclass('public.account_deletion_requests') is not null as deletion_jobs_already_exist,
 pg_catalog.to_regprocedure('public.prepare_account_deletion(uuid)') is not null as prepare_already_exists,
 pg_catalog.to_regprocedure('public.ack_account_deletion_files(uuid,text[])') is not null as ack_already_exists,
 pg_catalog.to_regprocedure('public.finish_account_deletion(uuid)') is not null as finish_already_exists;

-- K — Contagens EXATAS, sem dados pessoais. Cada consulta é um SELECT constante,
-- passado a query_to_xml SOMENTE se a relação existir. Sem execução de função do app.
-- Esperado: 5 linhas, exists_ok=true, total=0 em todas. NULL não significa zero.
with expected(table_name,readonly_query) as (values
 ('auth.users','select count(*) as total from auth.users'),
 ('public.profiles','select count(*) as total from public.profiles'),
 ('public.occurrences','select count(*) as total from public.occurrences'),
 ('public.occurrence_photo_files','select count(*) as total from public.occurrence_photo_files'),
 ('storage.objects','select count(*) as total from storage.objects')),
inventory as (
 select table_name,pg_catalog.to_regclass(table_name) is not null as exists_ok,
 case when pg_catalog.to_regclass(table_name) is not null
 then pg_catalog.query_to_xml(readonly_query,false,false,'') end as result
 from expected
)
select table_name,exists_ok,
 ((pg_catalog.xpath('/table/row/total/text()',result))[1]::text)::bigint as total
from inventory order by table_name;
