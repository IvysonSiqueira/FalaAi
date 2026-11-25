-- SOMENTE LEITURA. Destino: falaai-lgpd-validacao. Não executa a RPC.
-- Complementa as 131 verificações já aprovadas; não substitui o teste integrado.
with inspected as (
 select p.oid,p.proretset,p.prorettype,p.prosecdef,p.proconfig,l.lanname,
 pg_catalog.pg_get_function_result(p.oid) as actual_result
 from (values (1)) v(x)
 left join pg_catalog.pg_proc p on p.oid=pg_catalog.to_regprocedure('public.claim_occurrence_photo_cleanup()')
 left join pg_catalog.pg_language l on l.oid=p.prolang
)
select case when coalesce(oid is not null and actual_result='SETOF text'
 and proretset and prorettype=pg_catalog.to_regtype('pg_catalog.text')
 and prosecdef and lanname='plpgsql' and proconfig=array['search_path=""'],false)
 then 'PASSOU' else 'FALHOU' end as resultado,
 actual_result as retorno_postgresql,'SETOF text' as retorno_esperado,
 proretset as retorna_conjunto,
 prorettype=pg_catalog.to_regtype('pg_catalog.text') as tipo_base_text,
 prosecdef as security_definer,lanname as linguagem,proconfig as configuracao
from inspected;
