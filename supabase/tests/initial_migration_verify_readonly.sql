-- VERIFICADOR DE POS-APLICACAO. NAO E A MIGRACAO E NAO CRIA TABELAS.
-- Para APLICAR: supabase/migrations/20261121000100_initial_profiles_occurrences.sql.
-- Para saber se ja existem tabelas: usar initial_migration_state_and_signatures_readonly.sql.
-- SOMENTE SELECT. Manual, exclusivamente falaai-lgpd-validacao.
-- Não chama funções do aplicativo nem cria usuários ou dados de teste.
-- Bloco A pode ser executado ANTES; B-I somente APÓS sucesso da migração 001.
-- Executar um bloco por vez. Parar na primeira divergência/erro.

-- A — Dependências: todos os booleanos true e quatro roles retornados.
select pg_catalog.to_regclass('auth.users') is not null as auth_users_exists,
 pg_catalog.to_regprocedure('auth.uid()') is not null as auth_uid_exists,
 pg_catalog.to_regprocedure('pg_catalog.gen_random_uuid()') is not null as uuid_generator_exists,
 (select count(*) = 4 from pg_catalog.pg_roles where rolname in
   ('postgres','anon','authenticated','service_role')) as expected_roles_exist;

-- B — Duas tabelas existentes, RLS true. FORCE RLS não é exigido nesta arquitetura.
select expected.relation, c.oid is not null as table_exists, c.relrowsecurity as rls_enabled
from (values ('public.profiles'),('public.occurrences')) as expected(relation)
left join pg_catalog.pg_class c on c.oid = pg_catalog.to_regclass(expected.relation)
order by expected.relation;

-- C — Estrutura/defaults + constraints. Conferir com o arquivo 001, sem alterar.
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns where table_schema = 'public'
 and table_name in ('profiles','occurrences') order by table_name, ordinal_position;

select c.relname as table_name, k.conname, k.contype,
 pg_catalog.pg_get_constraintdef(k.oid) as definition
from pg_catalog.pg_constraint k join pg_catalog.pg_class c on c.oid = k.conrelid
where k.conrelid in (pg_catalog.to_regclass('public.profiles'), pg_catalog.to_regclass('public.occurrences'))
order by c.relname, k.contype, k.conname;

select tablename, indexname, indexdef from pg_catalog.pg_indexes
where schemaname = 'public' and tablename in ('profiles','occurrences')
order by tablename, indexname;

-- D — Seis políticas: profiles 2; occurrences 4. Não executa suas expressões.
select tablename, policyname, roles, cmd, qual, with_check
from pg_catalog.pg_policies where schemaname = 'public'
 and tablename in ('profiles','occurrences') order by tablename, policyname;

-- E — Grants de tabela: anon tudo false; authenticated SELECT nas duas, DELETE
-- só em occurrences; INSERT/UPDATE false aqui são normais (grants por coluna).
select expected.relation, roles.role_name,
 pg_catalog.has_table_privilege(roles.role_name::pg_catalog.name, c.oid, 'SELECT') as can_select,
 pg_catalog.has_table_privilege(roles.role_name::pg_catalog.name, c.oid, 'INSERT') as table_insert,
 pg_catalog.has_table_privilege(roles.role_name::pg_catalog.name, c.oid, 'UPDATE') as table_update,
 pg_catalog.has_table_privilege(roles.role_name::pg_catalog.name, c.oid, 'DELETE') as can_delete
from (values ('public.profiles'),('public.occurrences')) as expected(relation)
join pg_catalog.pg_class c on c.oid = pg_catalog.to_regclass(expected.relation)
cross join (values ('anon'),('authenticated')) as roles(role_name)
order by expected.relation, roles.role_name;

-- has_column_privilege exige attnum smallint (tipo nativo de pg_attribute.attnum).
-- F — POST-VERIFICACAO DE COLUNAS (arquivo initial_migration_verify_readonly.sql).
-- Seguro mesmo antes da criação: table_exists/column_exists false e privilégios NULL.
-- NULL significa não verificável, nunca aprovação. Depois da 001, todas as 28
-- linhas devem ter table_exists/column_exists true e privileges_match true.
select checked.table_name, checked.column_name, checked.role_name,
 checked.table_exists, checked.column_exists, checked.can_insert, checked.can_update,
 (checked.can_insert = (checked.role_name = 'authenticated' and checked.insert_allowed)
  and checked.can_update = (checked.role_name = 'authenticated' and checked.update_allowed)) as privileges_match
from (
 select expected.table_name, expected.column_name, roles.role_name,
  expected.insert_allowed, expected.update_allowed,
  c.oid is not null as table_exists, a.attnum is not null as column_exists,
  case when c.oid is not null and a.attnum is not null then
   pg_catalog.has_column_privilege(roles.role_name::pg_catalog.name, c.oid, a.attnum::smallint,'INSERT')
  end as can_insert,
  case when c.oid is not null and a.attnum is not null then
   pg_catalog.has_column_privilege(roles.role_name::pg_catalog.name, c.oid, a.attnum::smallint,'UPDATE')
  end as can_update
 from (values
  ('public.profiles','id',false,false), ('public.profiles','display_name',false,true),
  ('public.profiles','created_at',false,false),
  ('public.occurrences','id',false,false), ('public.occurrences','author_id',false,false),
  ('public.occurrences','status',false,false), ('public.occurrences','created_at',false,false),
  ('public.occurrences','updated_at',false,false),
  ('public.occurrences','category_id',true,true), ('public.occurrences','description',true,true),
  ('public.occurrences','location',true,true), ('public.occurrences','latitude',true,true),
  ('public.occurrences','longitude',true,true), ('public.occurrences','photo_path',true,true)
 ) as expected(table_name,column_name,insert_allowed,update_allowed)
 cross join (values ('anon'),('authenticated')) as roles(role_name)
 left join pg_catalog.pg_class c on c.oid = pg_catalog.to_regclass(expected.table_name)
 left join pg_catalog.pg_attribute a on a.attrelid = c.oid
   and a.attname = expected.column_name and a.attnum > 0 and not a.attisdropped
) as checked
order by checked.table_name, checked.column_name, checked.role_name;

-- G — Duas funções: create_profile SECURITY DEFINER true; touch_occurrence false;
-- search_path vazio nas duas; anon_execute/authenticated_execute false.
select p.proname, p.prosecdef as security_definer, p.proconfig,
 pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
 pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute
from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('falaai_create_profile','falaai_touch_occurrence')
order by p.proname;

-- H — Dois triggers FalaAí: AFTER INSERT auth.users e BEFORE UPDATE occurrences.
-- tgenabled=O é o padrão ativo. Definições são texto, não execução dos triggers.
select n.nspname as schema_name, c.relname as table_name, t.tgname, t.tgenabled,
 pg_catalog.pg_get_triggerdef(t.oid) as definition
from pg_catalog.pg_trigger t join pg_catalog.pg_class c on c.oid = t.tgrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where not t.tgisinternal and t.tgname in ('falaai_auth_user_created','falaai_occurrence_updated')
order by t.tgname;

-- I — Só contagens, nenhum e-mail/nome. No projeto novo e sem novos cadastros:
-- auth_users/profiles/occurrences=0; auth_without_profile=0.
select (select count(*) from auth.users) as auth_users,
 (select count(*) from public.profiles) as profiles,
 (select count(*) from public.occurrences) as occurrences,
 (select count(*) from auth.users a where not exists
   (select 1 from public.profiles p where p.id = a.id)) as auth_without_profile;
