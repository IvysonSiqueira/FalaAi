-- ESTADO E ASSINATURA. SOMENTE SELECT; NAO APLICA A MIGRACAO.
-- Executar manualmente SOMENTE em falaai-lgpd-validacao.
-- Seguro com tabelas ausentes. Nenhuma funcao do aplicativo e executada.
select
 pg_catalog.to_regclass('public.profiles') is not null as profiles_exists,
 pg_catalog.to_regclass('public.occurrences') is not null as occurrences_exists,
 pg_catalog.to_regprocedure('pg_catalog.has_column_privilege(name,oid,smallint,text)') is not null
   as column_privilege_signature_exists;
