-- SOMENTE LEITURA. Executar no painel do projeto confirmado falaai-prova3.
-- Antes e depois da migração: nada aqui cria bucket, muda grants ou aplica RLS.
select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'occurrence-photos';
select c.relrowsecurity as objects_rls_enabled,
  has_table_privilege('authenticated','storage.objects','SELECT') as authenticated_select,
  has_table_privilege('authenticated','storage.objects','INSERT') as authenticated_insert,
  has_table_privilege('authenticated','storage.objects','DELETE') as authenticated_delete
from pg_class c where c.oid = 'storage.objects'::regclass;
select to_regprocedure('storage.allow_only_operation(text)') is not null as operation_helper_available;
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies where (schemaname = 'storage' and tablename = 'objects')
  or (schemaname = 'public' and tablename in ('occurrences','occurrence_photo_files'))
order by schemaname, tablename, policyname;
select count(*) as occurrences_with_photo_path from public.occurrences where photo_path is not null;
select to_regclass('public.occurrence_photo_files') as photo_registry;
select proname, prosecdef, proconfig from pg_proc
where pronamespace = 'public'::regnamespace and proname in
  ('reserve_occurrence_photo','confirm_occurrence_photo_upload','abandon_occurrence_photo',
   'claim_occurrence_photo_cleanup','finish_occurrence_photo_cleanup','falaai_link_occurrence_photo','falaai_queue_deleted_photo');
