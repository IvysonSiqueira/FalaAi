# Inspeção de leitura do Supabase descartável — 24/11/2026

Destino confirmado: falaai-lgpd-validacao, validado por URL/Ref exatos e distinto
explicitamente do principal. Branch codex/prova-iii-supabase, worktree e8ce.
Checkpoint 46b9d6c preservado. Nenhuma migração, deploy ou criação/exclusão executada.

## Evidência efetivamente obtida

GETs autenticados exclusivamente no origin descartável, sem Bearer opaco,
User-Agent de Node, redirects proibidos e sem exibir respostas ou dados pessoais:

- /rest/v1/ com Accept application/openapi+json: HTTP 200, OpenAPI reconhecido.
  Nenhuma tabela profiles/occurrences/occurrence_photo_files/privacy_acceptances/
  account_deletion_requests exposta. Nenhuma das RPCs esperadas de fotos/exclusão exposta.
- /storage/v1/bucket: HTTP 200, zero buckets. occurrence-photos ausente.
- /auth/v1/admin/users?page=1&per_page=1: HTTP 200, lista de usuários vazia.

A Admin Key demonstrou acesso de leitura a metadados Storage e listagem Auth.
Isso não equivale a testar grants de usuários finais, RLS ou exclusão.
Não foram consultados valores de ocorrências, pois sua tabela não estava exposta.
Não foram encontrados dados a preservar nas superfícies consultadas. Não é prova
forense de ausência de dados em tabelas ocultas ou arquivos órfãos do provedor.

## Não verificável pelos endpoints usados

Triggers, catálogo pg_proc/pg_policies, grants detalhados e histórico de migrações
não são expostos por essas APIs. OpenAPI vazio não distingue ausência de tabelas,
falta de exposição/permissão ou cache desatualizado. A presença exata no PostgreSQL
continua pendente, mesmo com o estado aparente de projeto novo.

Inventário/deployment da Edge Function não foi consultado: exigiria painel ou
Management API com autorização própria. Não invocamos delete-account para descobrir
se existe: uma chamada a uma função desconhecida não é inspeção de deployment.
Conferir manualmente Dashboard → Edge Functions, sem implantar ou habilitar nada.

## Situação das migrações locais

| Migração | Evidência e estado |
| --- | --- |
| 20261121000100_initial_profiles_occurrences.sql | profiles/occurrences não expostas. Provavelmente pendente; confirmar catálogo. |
| 20261121000200_occurrence_photos_storage.sql | Registry/RPCs não expostas e bucket ausente. Pré-condição do bucket não atendida; confirmar catálogo. |
| 20261124000100_privacy_and_account_deletion.sql | Tabelas/RPCs não expostas. Provavelmente pendente e depende das anteriores. |

Não consideramos nenhuma delas comprovadamente aplicada ou validada nesta inspeção.

## Plano separado de execução futura — com pontos de parada

0. Conferir projeto descartável no Dashboard e executar apenas SELECTs de
   supabase/tests/disposable_inventory_readonly.sql. Esse arquivo não foi executado.
   Conferir também o inventário Edge no painel. Se aparecer estrutura/dado anterior,
   parar e revisar, sem apagar ou reexecutar CREATE TABLE. Histórico CLI ausente
   não significa que scripts nunca foram aplicados manualmente pelo SQL Editor.
1. Após confirmação e autorização específica, aplicar somente 001. Conferir duas
   tabelas, RLS, grants de colunas, FKs Auth e triggers de perfil/updated_at. Se
   qualquer verificação falhar, interromper; não aplicar automaticamente a seguinte.
2. Após autorização, criar occurrence-photos privado, 5242880 bytes, MIME exatamente
   JPEG/PNG/WebP. Conferir metadados pela API/painel. Não fazer upload ainda.
3. Antes da 002, confirmar helper storage.allow_only_operation(text), RLS habilitado
   e grants padrão de storage.objects. Conferir photo_path legado caso haja dados.
   Se faltar helper ou privilégio, parar; não ampliar SELECT/grants globalmente.
4. Após autorização, aplicar 002 e conferir registry, FK restritiva, RPCs, policies
   permissivas/restritivas e triggers de vínculo/limpeza. Não alterar a migração 001.
5. Após autorização, aplicar LGPD corrigida, verificar aceite somente para novos
   cadastros, ausência de backfill de aceite, trabalho durável, guards e RPC ACK.
   Conferir que anon/authenticated não executam RPCs administrativas e que o helper
   de poda não é diretamente executável por service_role. Parar se diferente.
6. Autorizar separadamente a suíte descartável: gerar contas próprias e arquivos
   de teste, validar 0/1/100/101/250, falhas, retomada, repetição e concorrência.
   Flags continuam vazias até essa autorização. A suíte RPC verifica prontidão;
   não prova o caminho completo da Edge Function até a remoção da identidade.
7. Somente após aprovação, implantar Edge Function inicialmente desabilitada e
   conferir configuração/segredos do runtime sem exibir valores. Autorizar ativação
   somente no descartável para testar HTTP, reautenticação, exclusão Auth e falhas.
8. Concluir cliente definitivo, testar sessão no Samsung e revisar resultados antes
   de propor qualquer alteração no projeto principal. Não reivindicar bônus antes.

## Riscos e dependências

- Migrações usam CREATE TABLE: reaplicar sem catálogo revisado causa erro; nunca
  compensar com DROP/RESET. A migração inicial inclui backfill de profiles se houver
  usuários preexistentes, portanto sua aplicação também é uma escrita.
- 002 depende do bucket pronto e de funções/permissões da versão do Storage.
- 003 substitui trigger de cadastro e exige aceite novo; clientes antigos sem
  metadata deixam de cadastrar depois dela. Contas antigas não recebem aceite falso.
- Registry de fotos tem FK RESTRICT: identidade só pode sair depois de limpeza
  confirmada. Uploads incertos podem exigir 24h de espera.
- Concorrência e runtime ainda sem validação real. Scripts locais/testes Node não
  substituem inspeção SQL, testes RLS nem integração Edge/Auth/Storage.
- O cabeçalho histórico da migração 002 cita o principal; não é um alvo técnico.
  Nesta validação, todos os passos são exclusivamente no descartável confirmado.
