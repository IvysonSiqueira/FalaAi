# Prova III — preparação local do bônus de privacidade

Data: 24/11/2026. Prazo da avaliação: 24/11/2026, 23h59 (America/Maceio).

## Estado real

**RLS A/B pendente por falha de autenticação A (`invalid_credentials`).** B autenticou;
a interface A/B foi validada no Samsung pelo aluno. Isso não substitui chamadas
diretas de API. Nenhuma nova autenticação nem chamada remota nesta preparação.

Preparados: aviso em português, checkbox acessível inicialmente desmarcado no
cadastro, metadata de aceite explícito, migração adicional e Edge Function com
trava de ativação. O checkbox é reiniciado ao trocar de aba. Login, sessão,
CRUD e configurações nativas permanecem com seus fluxos anteriores.

**Não implementado como funcionalidade ativa:** exclusão real pelo aplicativo.
O Perfil oferece uma confirmação informativa, explicitamente indisponível e sem
chamada ao servidor. Não há mensagem de solicitação enviada ou sucesso fictício.
O cliente definitivo (senha de reautenticação, progresso, retomada e encerramento
de sessão) deverá ser conectado somente após os testes de integração do servidor.

**Não executados:** migração SQL, deploy, testes PostgreSQL, runtime Deno,
validação remota LGPD ou teste visual desta rodada no Android. As ferramentas
Deno, PostgreSQL e Docker não estavam disponíveis localmente. Os testes Node
validam o núcleo com dependências simuladas, não a implantação nem o RLS real.
Não se considera o bônus concluído para avaliação ainda.

## Dados e aceite

O aviso descreve nome, e-mail, relatos, fotos e GPS, finalidade, Supabase,
visibilidade para usuários autenticados, fotos opcionais, links temporários,
limitações e backups. Não promete acompanhamento municipal nem apagamento de
cópias salvas por terceiros. Revisar contato do responsável e retenção do provedor
antes de publicação pública; este trabalho não equivale a certificação LGPD.

A interface só envia o cadastro após aceite; inclui `privacy_accepted: true` e
`privacy_version: 2026-11-24-v1` no signUp. Nenhuma data do cliente é aceita.
Antes da migração, essa metadata **não equivale** ao registro formal de aceite:
a tabela ainda não existe no remoto. Após a migração, o trigger valida versão e
aceite e cria `privacy_acceptances` com timestamp do banco na mesma transação do
cadastro. Sem aceite ou versão válida, o servidor rejeita o novo cadastro.
Essa declaração não prova que a pessoa leu cada palavra.

Não há backfill: contas existentes seguem funcionando e sem consentimento
retroativo. A tabela só permite leitura própria, sem inserção/alteração direta
pelo cliente. Alterar metadata depois não altera o registro. O aceite é removido
com a identidade. Não há coleta de IP ou dados extras para comprovação.

## Protocolo de exclusão preparado

1. Edge Function desabilitada salvo `ACCOUNT_DELETION_ENABLED=true` no servidor.
2. Somente POST JSON limitado a 2048 bytes, Bearer token, senha e confirmação
   literal `EXCLUIR MINHA CONTA`. UUID ou e-mail no corpo são recusados.
3. `auth.getUser(token)` valida identidade no Auth; senha atual é conferida por
   signInWithPassword com e-mail obtido do Auth, não do cliente. A sessão criada
   para essa conferência é encerrada com escopo local.
4. RPC administrativa cria trabalho durável por usuário e exclui somente seus
   relatos; triggers existentes enfileiram fotos na mesma transação. Novos relatos,
   alterações e reservas/uploads ficam bloqueados para a conta em exclusão.
5. Reservas de upload incerto e limpezas adiadas respeitam a janela de 24h.
   O endpoint retorna 202/pending, mantendo a identidade para nova tentativa.
6. Remove pela API Storage até 100 caminhos por chamada, obtidos do registro
   remoto do proprietário. Um ACK consulta metadata no PostgreSQL e conclui somente
   arquivos próprios, elegíveis, ausentes e sem referência. Isso ocorre mesmo após
   remoção parcial; se o processo cair antes do ACK, a preparação seguinte também
   remove esses registros concluídos antes de escolher o novo lote. O ACK repetido
   é idempotente e é serializado pela linha do trabalho de exclusão. Não drena a fila geral de outras contas; não usa
   DELETE SQL em `storage.objects`. Objetos não registrados causam interrupção.
7. RPC final verifica ausência de relatos e de objetos (inclusive outros buckets
   que ainda pertençam ao usuário), antes de remover o registro de fotos e liberar
   a FK restritiva. Só então `auth.admin.deleteUser` remove identidade e dependentes.
8. Falhas retornam mensagem genérica, sem logs de senha/token, mantendo trabalho
   para retomada. 202 ou 503 não são sucesso. Outros buckets exigem revisão manual;
   não são removidos automaticamente. A função não pode ser usada para apagar
   outra conta. O trabalho desaparece por cascade após remoção da identidade.

Após exclusão confirmada, o futuro cliente deverá limpar sessão local pelo SDK e
voltar ao fluxo de login. Se houver perda da resposta depois do delete Auth, a
identidade pode já ter sido removida; tratar esse caso explicitamente no cliente,
sem tentar recriar conta ou anunciar falha definitiva. Tokens JWT já emitidos
podem durar até expirar; as políticas existentes exigem perfil existente para
acesso comunitário e o perfil é removido por cascade. Testar esse cenário.
URLs assinadas já emitidas/caches podem durar até expirar; não prometer revogação
instantânea de cópias. A exclusão inicia uma operação irreversível e não tem cancelamento.

## Ordem de aplicação (somente após autorização)

1. Preservar versão funcional e revisar diff. Resolver login A e executar RLS A/B
   somente quando autorizado, em fixtures isoladas. Não declarar RLS aprovado antes.
2. Em Supabase **local ou projeto descartável**, aplicar migrações 001, 002 e
   `20261124000100_privacy_and_account_deletion.sql`, com bucket privado configurado
   conforme documentação Storage. Testar triggers, grants e concorrência.
3. Validar SQL e Deno antes do deploy:

   ```sh
   deno check supabase/functions/delete-account/index.js
   npx tsc --noEmit
   node --test tests/*.test.cjs
   git diff --check
   ```

   O deploy usa `supabase/config.toml`, entrypoint JS e `verify_jwt=false` porque a
   própria função valida o token com getUser. **Nunca retirar essa validação.**
4. Após aprovação explícita do destino `falaai-prova3`, disponibilizar primeiro o
   cliente com checkbox/metadata, depois executar a migração NOVA no SQL Editor.
   Não reexecutar nem editar migrações iniciais. Clientes antigos continuarão a
   entrar, mas cadastros antigos sem aceite serão bloqueados após a migração.
5. Somente após autorização, implantar com trava ainda desligada:

   ```sh
   supabase functions deploy delete-account --project-ref <PROJECT_REF_CONFIRMADO>
   ```

   `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` são variáveis
   do runtime Supabase. A chave administrativa nunca vai para Expo ou `.env` público.
   Confirmar a disponibilidade no runtime sem imprimir valores. Não configurar
   nem enviar chaves por chat, argumentos de shell ou arquivos versionados.
6. Habilitar `ACCOUNT_DELETION_ENABLED=true` **somente no ambiente descartável**,
   usando painel de secrets da Edge Function. Validar roteiro abaixo.
7. Aprovar testes de falha e concorrência. Preparar cliente definitivo, testes de
   sessão e validação no Samsung; só depois autorizar habilitação no projeto real.
   Se não houver tempo antes da entrega, manter o bônus isolado e demonstrar os
   requisitos obrigatórios já validados. Não habilitar exclusão para ganhar o bônus
   sem provar consistência entre Auth, banco e Storage.

## Roteiro com conta descartável

Não usar A/B nem usuários existentes para exclusão.

- Cadastro sem checkbox: bloqueado no aplicativo. Chamada direta sem aceite ou
  com versão errada: cadastro rejeitado pelo servidor após migração.
- Cadastro com aceite: confirmar e-mail; consultar aceite próprio, versão e data
  do servidor. Tentar alterar data/versão via API: negado.
- Conta anterior à migração: login normal, sem linha de aceite inventada.
- Criar conta descartável C e outra D, ambas confirmadas. C cria relatos com e sem
  fotos. Salvar IDs/caminhos para conferir ausência após exclusão.
- Sem token, token inválido, senha incorreta, confirmação ausente ou corpo com
  UUID de D: nenhuma exclusão nem trabalho criado. Conferir dados de C e D.
- Flag desligada: 503/disabled, sem remoção. Não confiar apenas nos testes simulados.
- Em ambiente descartável, causar falha de Storage após a preparação: identidade
  permanece, registro de trabalho permanece, fotos não são consideradas apagadas.
  Restaurar serviço e repetir com senha/token de C: retoma, não duplica trabalho.
- Reserva de upload incerto: 202, respeita prazo; não remover identidade antes.
- Mais de 100 arquivos: múltiplas chamadas; sem identidade removida prematuramente.
- Simular falha no delete Auth após limpeza: retomar sem reintroduzir arquivos.
- Testar upload concorrente/iniciado antes da solicitação, duas solicitações
  simultâneas e perda da resposta final. Esses cenários são bloqueantes de ativação.
- Sucesso: todas as fotos via Storage API ausentes, registros e registry ausentes,
  identidade removida e perfil/aceite/trabalho removidos por cascade. D intacto.
- Ao conectar futuro cliente: encerrar sessão somente em confirmação de sucesso,
  reiniciar Samsung e verificar desconexão; 202/503 devem oferecer retomada.

## Compatibilidade e fontes

Nenhuma dependência nativa adicionada. Expo 57, RN 0.86.3, EAS, câmera, GPS e
MapLibre preservados. O APK Development Build existente continua válido para JS.
A Edge Function tem runtime separado; aprovação de TypeScript do Expo não valida
seu adaptador Deno. SDK do servidor fixado em 2.119.2, igual ao cliente atual.

Referências oficiais consultadas:
- https://supabase.com/docs/guides/auth/managing-user-data
- https://supabase.com/docs/guides/storage/management/delete-objects
- https://supabase.com/docs/guides/functions/auth

## Correção dos lotes e revisão desta rodada

A causa era `ORDER BY path LIMIT 100` sobre um registro que só era removido no
final global. Com 101 fotos, as primeiras 100 já ausentes eram selecionadas para
sempre. Agora existe `ack_account_deletion_files`, acessível somente a service_role,
e um helper privado sem EXECUTE para public/anon/authenticated/service_role.
As RPCs SECURITY DEFINER chamam o helper como dono, com search_path vazio.

O ACK não acredita apenas no retorno da API Storage: consulta ausência real em
storage.objects, ausência de vínculo em occurrences e prazo/estado do registro.
Lotes alheios são recusados integralmente. Remove apenas os registros elegíveis,
nunca metadata de Storage por DELETE SQL. A preparação seguinte também conclui
registros já ausentes, recuperando interrupções entre Storage e ACK. O finalizador
só retorna pronto se não houver objetos, relatos ou registros obrigatórios.

A migração LGPD ainda NÃO foi aplicada e foi corrigida no próprio arquivo local.
As migrações 001/002 previamente aplicadas não foram editadas. Se alguém aplicar
uma versão antiga da migração LGPD fora deste fluxo, pare: será necessária outra
migração incremental; não reexecute CREATE TABLE sobre o banco existente.

O núcleo executa ACK em finally após a tentativa de Storage. Falha de remoção ou
ACK retorna retry_required, sem apagar identidade. ACK duplicado não duplica dados;
remoções concorrentes do mesmo caminho são idempotentes. As RPCs serializam sua
parte por FOR UPDATE no trabalho, mas não mantêm esse lock durante a chamada de
rede ao Storage/Auth. A identidade pode ser removida por uma requisição concorrente
antes de outra terminar; a segunda pode retornar erro seguro/401. Não há garantia
de resposta 200 para repetição depois de excluir a identidade. Isso precisa de
tratamento no futuro cliente e testes reais, sem anunciar sucesso falso.

A guarda de novas escritas, uploads em trânsito e concorrência entre preparação,
ACK e Auth ainda precisa de validação PostgreSQL/Storage/Deno. Os modelos locais
não demonstram isolamento transacional real. Não habilitar a função com base neles.

### Testes disponíveis

- `tests/account-deletion-batches.test.cjs`: 0/1/100/101/250 fotos, remoção parcial,
  queda antes do ACK, retorno de Storage sem remoção, repetição, concorrência e
  rejeição de lote de outro dono. Os testes de 101/250 falharam antes da correção.
- `tests/account-deletion.test.cjs`: mantém os cenários anteriores de autenticação,
  confirmação, falha parcial e proteção da identidade; fixture recebeu ACK neutro.
- `tests/account-deletion.local.integration.cjs`: sete testes OPT-IN que usam RPCs
  reais e upload/remove reais. **Não foram executados.** Não equivalem a PASS.

A suíte de integração só aceita HTTP em localhost/127.0.0.1/[::1], recusando URLs
remotas. Não usa `.env.rls-test.local`, não usa A/B e cria contas e arquivos próprios
no Supabase local. O cleanup remove somente essas contas criadas pela execução,
após confirmar ausência de fotos/registro. A chamada deleteIdentity do núcleo é
substituída por uma conferência de prontidão; o adaptador HTTP/Deno e a exclusão
Auth definitiva ainda exigem testes próprios em conta descartável.

Após autorização para preparar infraestrutura local (não instalada nesta rodada):

1. Iniciar Supabase local com Auth/PostgreSQL/Storage e configurar bucket privado
   conforme o guia de fotografias. Aplicar 001, 002 e LGPD somente nesse banco local.
   A 002 exige bucket já criado, portanto não iniciar aplicando migrações sem isso.
2. Criar arquivo ignorado `.env.lgpd-local.local`, sem exportar secrets no shell:

   ```dotenv
   FALAAI_LOCAL_SUPABASE_URL=http://127.0.0.1:54321
   FALAAI_LOCAL_PUBLISHABLE_KEY=
   FALAAI_LOCAL_SERVICE_ROLE_KEY=
   FALAAI_LOCAL_DELETION_TEST_APPROVED=yes
   ```

   As duas chaves devem ser do ambiente LOCAL; chave administrativa nunca no Expo.
3. Executar separadamente, sem iniciar Metro nesse processo:

   ```sh
   node --env-file=.env.lgpd-local.local --test tests/account-deletion.local.integration.cjs
   ```

4. Só considerar correção integrada validada após os sete cenários passarem com
   as RPCs reais. Em seguida validar adaptador Deno, upload concorrente, falha de
   Auth e perda da resposta final. Retomar o roteiro de Samsung/contas descartáveis.
5. Revisar destino e obter aprovação antes de qualquer migração ou implantação
   remota. O botão do Perfil continua indisponível e a flag do servidor desligada.

### RLS remoto sem depender da senha antiga A

Escolher B e uma conta descartável C confirmada e autenticável. A/B nos nomes das
variáveis são apenas papéis. Configurar manualmente B nos campos de A e C nos de B
em `.env.rls-test.local`, mantendo o Project Ref correto. Não alterar senha nem dados
de A. Não usar service_role nos testes remotos; não fornecer credenciais pelo chat.
Se faltar confirmação de e-mail, resolver manualmente e não repetir login inválido.

Após autorização explícita de autenticação remota: conferir presença e destino sem
imprimir valores; testar uma vez cada login e parar em caso de falha; depois rodar
`occurrences.integration.cjs` e `storage.integration.cjs`, somente com fixtures.
Nenhum teste remoto foi executado nesta rodada. RLS A/B segue pendente.
