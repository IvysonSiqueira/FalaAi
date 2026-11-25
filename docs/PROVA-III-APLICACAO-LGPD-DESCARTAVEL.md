# Migração LGPD — execução manual e validação descartável

Preparado em 25/11/2026. Não executado remotamente pelo agente.
Destino exclusivo: **falaai-lgpd-validacao**, Ref **ilkprwaxszztejsasmcs**.
Projeto principal falaai-prova3 bloqueado. Checkpoint 46b9d6c preservado.

## O que a revisão confirmou

A 003 depende da 001 (profiles, occurrences, trigger Auth) e da 002 (registro
privado de fotos, estados, datas, FK RESTRICT, Storage e triggers). A validação
manual A–K da 002 foi informada pelo aluno como aprovada; as 15 políticas antes
da LGPD correspondem a 6 da 001, 1 do registro e 8 do Storage. Depois da 003 são
18: acrescenta duas de leitura própria e uma restritiva para bloquear uploads.

A transação começa com BEGIN e termina com COMMIT. Cria duas tabelas e não altera
os dados dos usuários antigos. Substitui falaai_create_profile: apenas novos
cadastros exigirão privacy_accepted=true e privacy_version=2026-11-24-v1. A data
de aceite é now() no servidor; não é uma data enviada pelo cliente. Não há backfill
nem consentimento atribuído a usuários antigos. Login de usuários antigos não
passa por esse trigger de INSERT. Este é um registro técnico de aceite; não é
uma certificação jurídica de conformidade LGPD.

RPCs prepare_account_deletion(uuid), ack_account_deletion_files(uuid,text[]) e
finish_account_deletion(uuid) permitem EXECUTE ao service_role, não aos clientes.
Helper falaai_prune_deleted_account_files(uuid,text[]) é privado, inclusive sem
EXECUTE direto para service_role. SECURITY DEFINER usa search_path vazio.
Funções de trigger não permitem EXECUTE direto aos clientes. Duas novas tabelas
permitem somente SELECT próprio ao cliente autenticado; não há escrita direta.

A exclusão elimina relatos próprios e deixa a limpeza durável; o trigger 002
transfere as fotos para cleanup na mesma transação. O helper remove somente
registros próprios, sem referência e sem objeto Storage correspondente, respeitando
as esperas de 24h. prepare chama esse helper ANTES de LIMIT 100; o ACK também o
chama após remover arquivos. Assim, os primeiros 100 não ficam selecionados para
sempre em 101/250 arquivos. Finish exige ausência de relatos, arquivos, reservas
pendentes e registros de limpeza antes da remoção Auth. Não há DELETE SQL sobre
storage.objects: remoção de arquivo é via API. Falhas parciais preservam a
identidade e permitem repetir o fluxo. Locks serializam operações SQL, mas não
abrangem toda a chamada de rede: concorrência e falhas reais ainda precisam dos
testes integrados. A revisão local não substitui esses testes.

## Etapa 1 — aplicar somente a migração (ação manual, após aprovação)

1. Confirmar nome e Ref no painel. Não usar o SQL Editor de falaai-prova3.
2. Confirmar que a 002 foi verificada, o bucket permanece privado e o ambiente
   continua sem usuários, relatos ou fotos. Não reaplicar a 001 ou 002.
3. Abrir **supabase/migrations/20261124000100_privacy_and_account_deletion.sql**
   no VS Code. Esse é o arquivo de CRIAÇÃO, não o verificador.
4. Abrir consulta NOVA no SQL Editor do descartável, papel administrativo padrão.
5. Copiar o arquivo INTEIRO, de seu comentário inicial até COMMIT, sem misturar
   diagnóstico. Remover qualquer seleção parcial: executar todo o conteúdo uma vez.
6. Diante de erro: parar, guardar mensagem/linha, não repetir, não criar objetos
   isolados. BEGIN/COMMIT deve fornecer atomicidade; confirmar o estado pelo
   verificador, não presumir que houve sucesso ou rollback.
7. Com Success, abrir OUTRA consulta nova e executar integralmente o arquivo
   **supabase/tests/VERIFY_ONLY_003_lgpd_consolidated_readonly.sql**.

## Etapa 2 — uma grade de verificação

Uma única instrução WITH/SELECT retorna verificacao, resultado PASSOU/FALHOU e
detalhes. Não executa RPC, trigger, alteração ou exclusão. Se faltar um objeto,
o resultado falha, sem cast literal regclass que interrompa o diagnóstico.
H deve indicar sete contagens zero. Ausência não é interpretada como zero.

- A/B: seis tabelas com RLS e as seis novas colunas/tipos/NOT NULL.
- C: 14 funções esperadas das três migrações; assinatura, retorno, linguagem,
  SECURITY DEFINER, search_path e corpo EXATO contra o SQL local revisado.
- D/D2: EXECUTE por papel, helper privado e três RPCs administrativas service_role.
  Privilégios service_role nas funções antigas são explicitamente informativos.
- E: seis triggers (inclusive Auth), habilitação, eventos, função e coluna do
  trigger de vínculo da foto.
- F/F2: 18 políticas com nome, papel, comando, modo; ausência de políticas extras.
  **F valida metadados, não equivalência lógica completa das 15 expressões antigas**:
  elas já foram revisadas na 001/002. Detalhes devolve USING/CHECK de todas para
  preservação dessa cobertura; comparar com o resultado anterior se houver dúvida.
- G: novas tabelas e registro de fotos sem escrita cliente, inclusive grants de
  coluna. Usa has_column_privilege(oid,oid,smallint,text), nunca integer.
- H: vazio antes de criar qualquer fixture, inclusive Auth e Storage.
- I: FK para Auth e ação CASCADE nas duas novas tabelas, RESTRICT no registro,
  restrições, defaults e índices. Conferir detalhes: PK/FK user_id, versão fixa e
  CHECK state limitado a cleaning/ready. Contagem/tipo das restrições não basta
  para provar equivalência de qualquer CHECK arbitrário.
- J: bucket privado, 5242880 bytes, três MIME, helper e grants básicos Storage.
- K: tabelas public extras e funções/sobrecargas inesperadas do aplicativo.
- L: expressão de versão e políticas novas comparadas com formato normalizado.

Só avançar com todos PASSOU **e** detalhes de F/I compatíveis. A grade não chama
funções do aplicativo. Corpos são comparados como texto: diferença de comentário
ou espaço também falha de forma conservadora, exigindo revisão. Normalização das
expressões L tolera apenas formatação/casts já previstos: se PostgreSQL formatar
algo diferente, parar e revisar sem ampliar políticas.

Assinaturas revisadas: to_regclass(text), to_regprocedure(text),
has_table_privilege(oid,oid,text), has_column_privilege(oid,oid,smallint,text),
has_function_privilege(oid,oid,text), pg_get_function_result(oid),
pg_get_triggerdef(oid,boolean), pg_get_constraintdef(oid,boolean),
pg_get_expr(pg_node_tree,oid), pg_get_indexdef(oid), format_type(oid,integer),
query_to_xml(text,boolean,boolean,text), xpath(text,xml).
query_to_xml recebe exclusivamente SELECTs constantes e protegidos por existência;
não recebe entrada do usuário nem chama funções do app. Sem PostgreSQL local,
a compilação e execução real do verificador permanecem pendentes no SQL Editor.

## Etapa 3 — implantação futura da Edge Function, ainda NÃO autorizada

A migração não implanta nem habilita delete-account. Manter o botão informativo
no Perfil e flags destrutivas desabilitadas.

1. Após verificar a migração, revisar supabase/functions/delete-account/index.js,
   core.ts e supabase/config.toml. O entrypoint Deno importa o núcleo TypeScript.
2. Confirmar CLI Supabase disponível e conta com acesso ao descartável. Se faltar,
   obter autorização para ferramenta/instalação; não instalar Docker/stack local.
3. Conferir os segredos padrão NO runtime do descartável: SUPABASE_URL,
   SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY. O adaptador atual usa os valores
   legados JWT disponibilizados no servidor; não lê o arquivo do executor e não
   transfere a Admin Key local para o app. Não sobrescrever variáveis reservadas.
   Se o projeto desabilitou as chaves legadas ou o runtime não as disponibilizar,
   INTERROMPER para adaptar/testar o transporte server-side antes do deploy.
   Não assumir que sb_secret_ funciona como Bearer JWT; o transporte corrigido
   do executor Node não foi aplicado automaticamente à Edge Function.
4. Manter ACCOUNT_DELETION_ENABLED ausente ou false no ambiente da função.
5. Após autorização específica de deploy, executar na raiz e com Ref explícito:

   ```sh
   supabase functions deploy delete-account --project-ref ilkprwaxszztejsasmcs
   ```

   Não fazer supabase link/db push e não usar o Ref principal. O config.toml contém
   verify_jwt=false: a função valida o token REAL do usuário via getUser e exige
   reautenticação com senha. Isso não autoriza requisições anônimas a excluir dados.
6. Verificar implantação, imports, runtime e resposta disabled (503) antes de
   habilitar. Isso requer autorização de chamadas remotas de teste.
7. Habilitar somente no descartável e somente após autorização de testes
   destrutivos isolados. Configuração da flag pelo painel, sem chave em comandos.

## Etapa 4 — testes posteriores, cada etapa com autorização de destino/escopo

1. Executar preflight offline do executor, manter projeto principal bloqueado.
2. Autorizar explicitamente fixtures descartáveis, criação/remoção das próprias
   contas e arquivos. Somente então habilitar flags locais de teste e rodar:

   ```sh
   node scripts/lgpd-disposable.cjs --run-rpc
   ```

3. A suíte RPC/Storage cobre 0/1/100/101/250 fotos, falhas parciais, retomada, ACK
   perdido, repetição, concorrência e negação de RPC administrativa ao cliente.
   Ela NÃO prova a exclusão Auth pelo endpoint: seu deleteIdentity é substituído
   por conferência de prontidão, e o cleanup exclui apenas suas próprias fixtures.
4. Validar separadamente o endpoint Deno com conta descartável nova e uma segunda
   conta preservada: token ausente/inválido, senha errada, corpo com UUID rejeitado,
   aceite obrigatório, data/versão servidor, exclusão real até Auth, dados e Storage
   ausentes; simular falhas com identidade preservada e repetir até conclusão.
   Testar usuários anteriores ao termo em ambiente descartável sem inventar aceite.
   Esse teste HTTP ponta a ponta ainda precisa de harness/execução dedicada; não
   considerar coberto pela suíte RPC nem realizar pedidos destrutivos avulsos.
5. Completar RLS A/B com duas fixtures confirmadas/autenticáveis, sem a senha antiga
   inválida de A: leitura comunitária, negação de UPDATE/DELETE/mudança de dono e
   alteração de foto alheia, negação ao anônimo, preservação da outra conta.
6. Após sucesso real, preparar integração do cliente e teste no Samsung. Não apontar
   o app principal ao descartável nem alterar .env.local nesta preparação.
   Só depois planejar implantação principal, com nova aprovação e plano de recuperação.

## Limites e interrupção

Erro SQL, objeto inesperado, permissão cliente ampliada, corpo divergente, dado
preexistente, bucket divergente ou qualquer acesso entre contas indevido impede
avanço. Não contornar com privilégios globais, chave no app, reaplicação automática
ou exclusão manual de dependências. Migração é transacional, mas a exclusão via
rede é um processo recuperável, não uma transação única SQL+Storage+Auth.
Bônus continua NÃO validado até executar a exclusão real e finalizar o cliente.

Fontes oficiais consultadas para procedimento futuro:
- https://supabase.com/docs/guides/functions/deploy
- https://supabase.com/docs/guides/functions/secrets
- https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys
