-- VERIFICACAO DO BUCKET / PRE-CONDICOES DA 002. SOMENTE SELECT.
-- Manual e exclusivamente no projeto falaai-lgpd-validacao.
-- Nao cria bucket nem chama RPCs ou helpers Storage. Um bloco por vez.

-- A — Depois de criar bucket: uma linha; quatro validacoes true.
select b.id is not null as bucket_exists,
 b.id, b.name, b.public, b.file_size_limit, b.allowed_mime_types,
 b.public is false as private_ok,
 coalesce(b.file_size_limit = 5242880,false) as size_ok,
 coalesce(
   b.allowed_mime_types @> array['image/jpeg','image/png','image/webp']::text[]
   and b.allowed_mime_types <@ array['image/jpeg','image/png','image/webp']::text[]
   and pg_catalog.cardinality(b.allowed_mime_types) = 3,
 false) as mime_ok
from (values ('occurrence-photos')) as expected(id)
left join storage.buckets b on b.id = expected.id;

-- B — Infraestrutura e dependencias: uma linha, todos true.
select c.oid is not null as storage_objects_exists, c.relrowsecurity as storage_rls,
 pg_catalog.has_table_privilege('authenticated',c.oid,'SELECT') as authenticated_select,
 pg_catalog.has_table_privilege('authenticated',c.oid,'INSERT') as authenticated_insert,
 pg_catalog.has_table_privilege('authenticated',c.oid,'DELETE') as authenticated_delete,
 pg_catalog.to_regprocedure('storage.allow_only_operation(text)') is not null as operation_helper_exists,
 pg_catalog.to_regclass('public.profiles') is not null as profiles_exists,
 pg_catalog.to_regclass('public.occurrences') is not null as occurrences_exists
from (values ('storage.objects')) as expected(relation)
left join pg_catalog.pg_class c on c.oid = pg_catalog.to_regclass(expected.relation);

-- C — Somente apos confirmar occurrences em B: esperado zero/zero.
-- Le so contagens, nenhum caminho, coordenada ou imagem e retornado.
select (select count(*) from public.occurrences where photo_path is not null) as legacy_photo_paths,
 (select count(*) from storage.objects where bucket_id = 'occurrence-photos') as stored_objects;

-- D — Objetos de 002 ainda devem estar ausentes, ambos false.
select pg_catalog.to_regclass('public.occurrence_photo_files') is not null as registry_exists,
 pg_catalog.to_regclass('public.occurrences_unique_photo_path') is not null as photo_index_exists;

-- E — Funcoes 002 ainda ausentes: zero linhas. Apenas metadados, nao executa.
select p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid) as arguments
from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in
 ('reserve_occurrence_photo','confirm_occurrence_photo_upload','abandon_occurrence_photo',
 'claim_occurrence_photo_cleanup','finish_occurrence_photo_cleanup',
 'falaai_link_occurrence_photo','falaai_queue_deleted_photo')
order by p.proname;

-- F — Politicas Storage existentes precisam de revisao antes da 002.
-- No projeto novo, normalmente zero linhas. Nao altera nem avalia as expressoes.
select policyname, permissive, roles, cmd, qual, with_check
from pg_catalog.pg_policies where schemaname = 'storage' and tablename = 'objects'
order by policyname;
