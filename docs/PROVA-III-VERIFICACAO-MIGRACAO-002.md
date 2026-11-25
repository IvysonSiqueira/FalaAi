# Verificação manual pós-migração 002 — ambiente descartável

Destino exclusivo: **falaai-lgpd-validacao**, Project Ref **ilkprwaxszztejsasmcs**.
Não executar no projeto principal falaai-prova3. O sucesso informado pelo SQL Editor
é evidência de execução, mas não substitui a conferência estrutural.

## Arquivo certo e execução

Abrir no VS Code **supabase/tests/VERIFY_ONLY_002_structure_readonly.sql**.
Esse arquivo verifica; não cria nada. Não copiar novamente o arquivo de
supabase/migrations/20261121000200_occurrence_photos_storage.sql.

1. Confirmar nome e Project Ref no painel do projeto descartável.
2. Abrir SQL Editor → nova consulta, com o papel administrativo padrão do editor.
3. Copiar um bloco completo por vez, incluindo seus WITH/SELECT até o ponto e vírgula.
   Blocos C, F, G e I têm mais de uma consulta: executar e conferir todas.
4. Não misturar com migrações, scripts anteriores ou comandos de criação.
5. Parar na primeira divergência ou erro. Não corrigir grants nem criar objetos isolados.
6. Retornar somente resultados estruturais, booleanos e contagens. Não enviar dados
   pessoais, credenciais, tokens ou conteúdo de registros.

## Resultados esperados por bloco

| Bloco | Conferência | Esperado antes da LGPD |
|---|---|---|
| A | Relações e RLS | 5 linhas, todas existem; RLS true em profiles, occurrences, occurrence_photo_files e storage.objects. Não impor RLS de buckets por este roteiro. |
| B | Colunas, tipos, defaults e nullability | 11 linhas, exists_ok true; registro: path text, owner_id uuid, state text, created_at/cleanup_after timestamptz, todos NOT NULL; path sem default, state pending e datas now(). occurrences.author_id uuid NOT NULL e photo_path text nullable; storage bucket_id/name/owner_id text; auth.users.id uuid. |
| C | Restrições e índices | Registro: PK path, FK owner_id → auth.users(id) ON DELETE RESTRICT, CHECK de quatro estados, CHECK de caminho UUID/UUID.ext com prefixo do proprietário. Dois índices no registro: PK e cleanup(owner_id,state,created_at). Terceira linha de índice: occurrences_unique_photo_path UNIQUE parcial WHERE photo_path IS NOT NULL. |
| D | RPCs e funções de trigger | 7 linhas presentes, resultado igual ao esperado; plpgsql, SECURITY DEFINER, search_path vazio; comparar function_body com o arquivo original da migração. Não basta conferir só o nome. |
| E | Triggers | 2 linhas presentes e habilitadas normalmente O; BEFORE INSERT OR UPDATE OF photo_path chama falaai_link_occurrence_photo; AFTER DELETE chama falaai_queue_deleted_photo. |
| F | Políticas | 8 linhas Storage, exists_ok/expected_match true; mais uma política no registro, occurrence_photo_files_select_own, SELECT authenticated com owner_id=auth.uid(). Conferir as expressões abaixo. |
| G | Privilégios | Registro: anon sem privilégios; authenticated SELECT true e INSERT/UPDATE/DELETE/TRUNCATE false. Storage authenticated SELECT/INSERT/DELETE true. G2: nenhum grant de coluna no registro; occurrences mantém INSERT e UPDATE apenas nas seis colunas category_id,description,location,latitude,longitude,photo_path para authenticated. Grants do proprietário administrativo são normais. G3: anon EXECUTE false nas sete funções; authenticated true nas cinco RPCs e false nas duas funções de trigger. service_role é informativo, não deve ser comparado com os papéis clientes. |
| H | Bucket | ready true e XML com exatamente uma row: id/name occurrence-photos, public false, file_size_limit 5242880, somente image/jpeg,image/png,image/webp; private_ok/size_ok/mime_ok true. XML vazio não significa aprovação. |
| I | Inventário adicional | Três tabelas public do aplicativo; oito políticas Storage; sete funções de fotos sem sobrecargas inesperadas, além das funções da migração 001; triggers 001 e os dois novos de fotos. Objetos de extensões conhecidos devem ser identificados, nunca apagados por este diagnóstico. |
| J | Pré-LGPD | Todos false: privacy_acceptances/account_deletion_requests e RPCs de exclusão ainda ausentes. |
| K | Dados | 5 linhas, exists_ok true e total zero em auth.users, profiles, occurrences, occurrence_photo_files e storage.objects. Contagem global de objetos detecta também fotografias em outros buckets. Qualquer total não zero exige preservar e investigar. |

### Expressões Storage a conferir em F

- **anon_guard**: RESTRICTIVE ALL anon, USING e WITH CHECK excluem occurrence-photos.
- **insert_guard / insert_own**: respectivamente restritiva/permissiva INSERT
  authenticated; exigem reserva pending no registro, path=name e owner_id=auth.uid().
  A restritiva permite buckets alheios; a permissiva aplica somente a occurrence-photos.
- **update_guard**: RESTRICTIVE UPDATE authenticated, USING e WITH CHECK excluem
  occurrence-photos. Substituição não utiliza upsert/alteração no mesmo arquivo.
- **select_guard / select_linked**: restritiva/permissiva SELECT authenticated;
  permitem foto vinculada a ocorrência visível via RLS. Exceção de limpeza exige
  operação Storage delete/delete_many e registro cleanup próprio já vencido.
  Essa exceção não deve liberar download de reservas.
- **delete_guard / delete_own_cleanup**: restritiva/permissiva DELETE authenticated;
  exigem registro cleanup próprio vencido e ausência de referência em occurrences.
- Comparar expressões com a migração; diferenças de espaços, parênteses ou casts
  gerados pelo PostgreSQL são normais. Diferenças de condições/roles não são.

## Segurança e assinaturas do verificador

Todas as instruções externas são SELECT. Não há DO, DDL, DML, GRANT, SET,
transação de escrita ou invocação de RPC/trigger do aplicativo.
Catálogos são ligados por OID; to_regclass/to_regprocedure devolvem NULL quando
objetos não existem. Não há cast literal para regclass nem has_column_privilege.
As consultas de privilégio usam as assinaturas (oid,oid,text) de
has_table_privilege e has_function_privilege, protegidas pela existência do papel/objeto.
ACLs usam aclexplode(aclitem[]) e acldefault("char",oid).

H e K usam query_to_xml(text,boolean,boolean,text) exclusivamente com SELECTs fixos
presentes no próprio arquivo, sem SQL externo, interpolação de entrada ou chamadas
às funções do aplicativo. Isso adia a análise das tabelas até a confirmação de sua
existência e fornece contagens exatas, não estimativas do coletor de estatísticas.
H também confere previamente as cinco colunas. XML é saída estrutural/contagens.
Permissão insuficiente ou indisponibilidade do suporte XML é motivo para parar,
não para conceder privilégios ou ignorar o bloco.

## Compatibilidade com a futura migração LGPD

A migração LGPD depende do registro de fotos, de seus estados e datas, do
proprietário UUID e da FK RESTRICT com Auth; utiliza o trigger AFTER DELETE para
transferir fotografias vinculadas à limpeza e preserva a janela de 24 horas para
uploads incertos. Depende também de occurrences.author_id/photo_path,
storage.objects.bucket_id/name/owner_id e da função falaai_create_profile da 001.
Confirmar que a verificação da 001 continua aprovada e comparar D/E com a 002.

O índice UNIQUE evita duas ocorrências usando o mesmo caminho. Os dois triggers
precisam estar habilitados e com os corpos originais. A ausência dos objetos J
confirma somente que a LGPD não aparenta ter sido aplicada; não valida sua lógica.
A migração 002 não habilita exclusão de conta: sua FK RESTRICT exige limpar fotos
antes de remover Auth. Não tentar excluir contas para verificar essa dependência.

## Interromper se

- Destino ou Project Ref diferente; erro SQL, NULL inesperado, objeto ausente,
  resultado/assinatura/default incompatível ou trigger desabilitado.
- Bucket público, tamanho diferente de 5242880 ou MIME extra/ausente.
- EXECUTE para anon, escrita direta no registro pelo cliente, política extra ou
  expressão permissiva que não corresponda à migração.
- Registros, contas ou objetos existentes quando o ambiente deveria estar vazio.
- Objetos LGPD já presentes, sobrecargas ou funções/triggers adicionais sem explicação.

Não reaplicar a 002 para consertar divergências. Guardar a mensagem e os resultados
estruturais, sem segredos. A próxima etapa depende de aprovação específica após
esta revisão. Nenhuma migração LGPD, Edge Function ou exclusão está autorizada
por este roteiro. Estrutura aprovada não equivale a testes remotos de RLS,
upload, concorrência ou exclusão aprovados.
