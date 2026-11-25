-- Diagnóstico após erro 42P01. SOMENTE SELECT; não reexecuta a migração.
-- Exclusivamente SQL Editor de falaai-lgpd-validacao. Executar um bloco por vez.
-- Não chama funções do aplicativo, não dispara triggers e não lê nomes/e-mails.

-- A — Presença de tabelas e RLS, seguro mesmo se não existem.
select expected.relation, c.oid is not null as exists_in_catalog,
       c.relrowsecurity as rls_enabled
from (values ('auth.users'),('public.profiles'),('public.occurrences')) as expected(relation)
left join pg_catalog.pg_class c on c.oid = pg_catalog.to_regclass(expected.relation)
order by expected.relation;

-- B — Funções criadas pela 001 (zero linhas é compatível com rollback/ausência).
select n.nspname as schema_name, p.proname, p.prosecdef, p.proconfig
from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('falaai_create_profile','falaai_touch_occurrence')
order by p.proname;

-- C — Triggers FalaAí. pg_get_triggerdef apenas retorna a definição como texto.
select n.nspname as schema_name, c.relname as table_name, t.tgname, t.tgenabled,
       pg_catalog.pg_get_triggerdef(t.oid) as definition
from pg_catalog.pg_trigger t join pg_catalog.pg_class c on c.oid = t.tgrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where not t.tgisinternal and t.tgname in ('falaai_auth_user_created','falaai_occurrence_updated')
order by t.tgname;

-- D — Políticas remanescentes. Não avalia nem executa qual/with_check.
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_catalog.pg_policies
where schemaname = 'public' and tablename in ('profiles','occurrences')
order by tablename, policyname;

-- E — Índices remanescentes. Zero linhas se tabelas ausentes.
select schemaname, tablename, indexname from pg_catalog.pg_indexes
where schemaname = 'public' and tablename in ('profiles','occurrences')
order by tablename, indexname;

-- F — DEPENDENCIAS EXTERNAS (arquivo initial_migration_failure_readonly.sql).
-- Este bloco NÃO contém has_column_privilege nem acessa public.profiles.
-- Esperado: todos os quatro booleanos true, independentemente das tabelas do app.
select pg_catalog.to_regclass('auth.users') is not null as auth_users_exists,
 pg_catalog.to_regprocedure('auth.uid()') is not null as auth_uid_exists,
 pg_catalog.to_regprocedure('pg_catalog.gen_random_uuid()') is not null as uuid_generator_exists,
 (select count(*) = 4 from pg_catalog.pg_roles
  where rolname in ('postgres','anon','authenticated','service_role')) as expected_roles_exist;

-- G — Event triggers de DDL preexistentes. Apenas metadados, sem chamar handlers.
-- Event triggers padrão Supabase podem existir e não são prova de erro.
select e.evtname, e.evtevent, e.evtenabled, e.evttags,
       n.nspname as handler_schema, p.proname as handler_name
from pg_catalog.pg_event_trigger e join pg_catalog.pg_proc p on p.oid = e.evtfoid
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
order by e.evtname;
