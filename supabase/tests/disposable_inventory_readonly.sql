-- SOMENTE SELECT. Executar manualmente no SQL Editor de falaai-lgpd-validacao.
-- Confirmar o projeto no Dashboard antes. Não executar no projeto principal.
-- Este arquivo não foi executado pelo agente. Não cria estruturas nem toca dados.
-- Copiar e executar UM BLOCO A-J por vez, em consulta vazia no painel.
-- SELECT não é garantia por si só: funções abaixo foram revisadas individualmente.
-- Todas as funções chamadas são built-ins qualificados em pg_catalog, para
-- introspecção/consulta de privilégios. Funções do aplicativo/Storage NÃO são chamadas.
-- Palavras INSERT/DELETE/EXECUTE em strings e resultados são nomes de privilégios,
-- não comandos executados. Não adicionar DO, CALL, RPC, SET ou EXPLAIN ANALYZE.

-- BLOCO A — Tabelas e RLS (esperado: cinco linhas, existência false).
select expected.relation, c.oid is not null as exists_in_catalog,
       c.relrowsecurity as rls_enabled
from (values ('public.profiles'), ('public.occurrences'),
 ('public.occurrence_photo_files'), ('public.privacy_acceptances'),
 ('public.account_deletion_requests')) as expected(relation)
left join pg_catalog.pg_class c on c.oid = pg_catalog.to_regclass(expected.relation)
order by expected.relation;

-- BLOCO B — Funções e privilégios (esperado: zero linhas).
select n.nspname as schema_name, p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid) as arguments,
       p.prosecdef as security_definer, p.proconfig,
       pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
       pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
       pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_execute
from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and (p.proname like 'falaai!_%' escape '!' or p.proname in (
 'reserve_occurrence_photo','confirm_occurrence_photo_upload','abandon_occurrence_photo',
 'claim_occurrence_photo_cleanup','finish_occurrence_photo_cleanup',
 'prepare_account_deletion','ack_account_deletion_files','finish_account_deletion'))
order by p.proname, arguments;

-- BLOCO C — Triggers FalaAí (esperado: zero linhas).
select n.nspname as schema_name, c.relname as table_name, t.tgname, t.tgenabled,
       pg_catalog.pg_get_triggerdef(t.oid) as definition
from pg_catalog.pg_trigger t join pg_catalog.pg_class c on c.oid = t.tgrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where not t.tgisinternal and n.nspname in ('public','auth')
  and t.tgname like 'falaai!_%' escape '!'
order by n.nspname, c.relname, t.tgname;

-- BLOCO D — Políticas (esperado: zero políticas próprias do FalaAí).
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_catalog.pg_policies
where (schemaname = 'storage' and tablename = 'objects')
 or (schemaname = 'public' and tablename in ('profiles','occurrences',
 'occurrence_photo_files','privacy_acceptances','account_deletion_requests'))
order by schemaname, tablename, policyname;

-- BLOCO E — Grants de tabelas (grants padrão de storage.objects podem existir).
select grantee, table_schema, table_name, privilege_type
from information_schema.role_table_grants
where table_schema in ('public','storage') and table_name in ('profiles','occurrences',
 'occurrence_photo_files','privacy_acceptances','account_deletion_requests','objects')
order by table_schema, table_name, grantee, privilege_type;

-- BLOCO F — Grants de colunas do aplicativo (esperado: zero linhas).
select grantee, table_schema, table_name, column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public' and table_name in ('profiles','occurrences')
order by table_name, grantee, column_name, privilege_type;

-- BLOCO G — Bucket (esperado: zero linhas antes da criação autorizada).
select id, public, file_size_limit, allowed_mime_types from storage.buckets
where id = 'occurrence-photos';
-- BLOCO H — Pré-condições Storage (esperado: uma linha, todos true).
select c.oid is not null as storage_objects_exists, c.relrowsecurity as storage_objects_rls,
 pg_catalog.has_table_privilege('authenticated',c.oid,'SELECT') as authenticated_select,
 pg_catalog.has_table_privilege('authenticated',c.oid,'INSERT') as authenticated_insert,
 pg_catalog.has_table_privilege('authenticated',c.oid,'DELETE') as authenticated_delete
from (values ('storage.objects')) as expected(relation)
left join pg_catalog.pg_class c on c.oid = pg_catalog.to_regclass(expected.relation);
-- BLOCO I — Disponibilidade de helper (esperado: true; NÃO executa o helper).
select pg_catalog.to_regprocedure('storage.allow_only_operation(text)') is not null as operation_helper_available;

-- BLOCO J — Existência do histórico CLI (true OU false; isoladamente não decide).
-- Consulta apenas existência; não executa migrações nem lê scripts armazenados.
select pg_catalog.to_regclass('supabase_migrations.schema_migrations') is not null as cli_migration_history_exists;
