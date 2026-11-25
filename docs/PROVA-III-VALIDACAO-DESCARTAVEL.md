# Validação isolada — falaai-lgpd-validacao

Preparação local em 24/11/2026. Nenhuma operação remota autorizada por este documento.
Checkpoint funcional preservado: 46b9d6c0817254ec6941042e04fd98b22da4c3a8.
Não depende de Docker, Podman ou stack local. O aplicativo e seu .env.local não mudam.

## O que está preparado

- `scripts/lgpd-disposable.cjs`: preflight sem rede e modo de execução separado.
- `tests/helpers/lgpd-target.cjs`: bloqueio fixo do Ref do principal, bloqueio
  adicional da URL atual do aplicativo, comparação exata URL/Ref, HTTPS padrão,
  rejeição de credenciais na URL e fetch limitado ao mesmo origin, sem redirects.
- `tests/account-deletion.disposable.integration.cjs`: suíte separada da local,
  desativada por padrão. Nenhum teste foi executado contra Supabase nesta etapa.
- Credenciais somente em `.env.lgpd-validacao.local`, ignorado, criado sem chaves.
  O executor lê esse arquivo sem expansão de $, sem exportar variáveis ao Metro
  e sem modificar ou carregar configurações Expo. Não herda credenciais do shell.
- Admin SDK somente no processo Node dos testes. Nenhum segredo foi adicionado a src.

O nome do projeto é uma confirmação manual do responsável. Preflight offline não
consulta a Management API nem consegue provar o nome exibido no Dashboard ou a
validade de uma chave opaca. Conferir falaai-lgpd-validacao e seu Ref no painel é
pré-condição obrigatória. Publishable keys e secret keys novas são opacas; a checagem
real das permissões será feita pelo Supabase apenas na futura execução autorizada.
A checagem do payload de service_role legada não substitui validação de assinatura.

## Configuração local a preencher

No arquivo ignorado `.env.lgpd-validacao.local`:

```dotenv
FALAAI_LGPD_PROJECT_NAME=falaai-lgpd-validacao
FALAAI_LGPD_PROJECT_REF=
FALAAI_LGPD_URL=
FALAAI_LGPD_PUBLISHABLE_KEY=
FALAAI_LGPD_ADMIN_KEY=
FALAAI_LGPD_ALLOW_TESTS=
FALAAI_LGPD_ALLOW_FIXTURE_DELETION=
```

Copiar Project Ref, URL HTTPS raiz e chaves SOMENTE do novo projeto descartável.
A ADMIN_KEY pode ser Secret API key ou service_role legada desse projeto. Nunca
colocar chaves administrativas em EXPO_PUBLIC, .env.local do app ou chat. Não são
necessários e-mails/senhas pessoais: o executor gera credenciais de fixtures,
cria contas confirmadas pela API administrativa e não envia e-mails de confirmação.

Deixar as duas autorizações vazias nesta etapa. Só preencher com `yes` depois da
autorização específica para criar e limpar fixtures. Não existe chave fictícia que
permita tratar preflight como validação real do serviço.

Com tudo preenchido, a conferência abaixo não usa rede, não testa login e exibe
somente presença de campos e diagnósticos booleanos, sem valores:

```sh
node scripts/lgpd-disposable.cjs --preflight
```

Não compartilhar o conteúdo do arquivo nem copiar keys para a documentação.
O Ref do principal é identificador público, fixado no guard para impedir erros de
configuração; nenhuma chave do principal foi copiada para o executor.

## Relatório de pré-condições / ordem de configuração

Estado atual: falta criação manual do novo projeto e preenchimento local. Nada foi
aplicado no remoto. Projeto principal e banco descartável não podem ter o mesmo Ref.

Após confirmação do destino e autorização específica:

1. No SQL Editor SOMENTE do descartável, aplicar
   `20261121000100_initial_profiles_occurrences.sql`.
2. Pelo painel Storage desse mesmo projeto, criar `occurrence-photos` privado,
   limite 5242880 bytes, apenas image/jpeg, image/png e image/webp.
3. Conferir `supabase/tests/storage_preflight.sql` nesse projeto. A migração 002
   exige grants/RLS padrão, helper storage.allow_only_operation e bucket correto.
4. Aplicar `20261121000200_occurrence_photos_storage.sql`. Banco deve estar sem
   photo_path legado. Não copiar dados pessoais/usuários do principal.
5. Aplicar `20261124000100_privacy_and_account_deletion.sql` corrigida. Ela exige
   aceite em NOVOS cadastros, preserva os usuários antigos sem consentimento falso
   e prepara RPCs administrativas de limpeza. Nunca reexecutar CREATE TABLE em
   projeto onde a mesma migração já foi aplicada.
6. Confirmar existência das tabelas, RPCs e privilégios. Somente a partir disso
   autorizar criação, autenticação e limpeza dos usuários de fixture.
7. Executar a suíte RPC abaixo. Nenhuma migração ou deploy é realizado pelo runner.
8. Em outra etapa autorizada, implantar Edge Function no projeto descartável com
   exclusão desabilitada. Conferir secrets do runtime sem exibi-los, testar HTTP,
   autenticação e reautenticação. Habilitar somente nesse ambiente para validar
   exclusão final e sessão com conta descartável.
9. Revisar todos os resultados antes de qualquer alteração no projeto principal.
   Implementar/validar cliente definitivo e solicitar autorização de ativação.

A configuração de envio de e-mail não precisa ser alterada para a suíte RPC:
fixtures são criadas confirmadas com admin.createUser. A demonstração final de
cadastro/aceite deve validar também o fluxo real de e-mail quando habilitado.

## Futura execução (não autorizada nesta rodada)

Depois das pré-condições e autorização, preencher ambas as flags com yes e usar:

```sh
node scripts/lgpd-disposable.cjs --run-rpc
```

O runner exige o Ref exato, impede o principal e inicia só a suíte descartável.
Os clientes Supabase usam fetch restrito ao origin autorizado e redirects proibidos.
A suíte local original continua limitada a localhost e não foi enfraquecida.

O escopo contém apenas UUIDs devolvidos pela criação de usuários desta execução.
Senhas são geradas em memória; caminhos são registrados antes do upload. O executor
não lista usuários existentes nem varre folders/fila geral. O cleanup usa os UUIDs
criados e os caminhos exatos do manifesto em memória. Se a confirmação de limpeza
falhar, não remove a identidade. Não há rotina de limpeza global de execuções antigas.

Cobertura prevista com RPCs/Storage reais: 0/1/100/101/250 fotografias, progresso por
lote, falha parcial, queda antes do ACK, repetição, concorrência e grants/RLS contra
chamadas administrativas pelo usuário. Uma segunda conta de fixture deve permanecer
intacta até seu próprio cleanup. Todas as contas do teste são descartáveis e novas.

IMPORTANTE: deleteIdentity do núcleo está substituído por uma verificação de
prontidão nessa suíte. A remoção Auth é feita somente no cleanup das contas que
ela mesma criou. PASS nessa suíte não prova o adaptador HTTP, Deno, a remoção Auth
pelo fluxo completo nem encerramento da sessão no celular. Esses testes precisam
ser feitos posteriormente na Edge Function com aprovação separada.

Se houver perda de resposta na criação de usuário/reserva ou processo interrompido,
podem sobrar fixtures. Não procurar/apagar contas por prefixo automaticamente:
conferir manualmente no projeto descartável. Isso nunca autoriza tocar no principal.

## Pendências explícitas

- Projeto e credenciais do descartável ainda não confirmados/configurados.
- Migrações, bucket, RPCs e Edge Function sem validação integrada remota.
- RLS com duas contas autenticáveis segue pendente; não repetir a senha antiga de A.
  Para o teste comunitário, utilizar B/C confirmadas e fixtures, após confirmar
  explicitamente qual projeto e quais contas serão usados.
- Nenhuma permissão para migrar, implantar, habilitar exclusão ou apagar dados foi
  inferida da aprovação para preparar o executor.
- Bônus LGPD não funcional até exclusão real validada e cliente concluído.

## Investigação offline do HTTP 401 (24/11/2026)

A requisição que retornou 401 foi um GET avulso executado pelo agente, não o modo
--run-rpc. Enviou `apikey` e `Accept`, sem Authorization. Portanto não há evidência
de que aquele 401 tenha sido causado por API key usada como JWT. A leitura nativa
do arquivo foi conferida sem exibir valores: sem espaços externos, aspas residuais
ou caracteres invisíveis. O runtime Node tem User-Agent padrão node; não houve
captura do cabeçalho efetivo no servidor. A causa do 401 permanece inconclusiva.

Há uma incompatibilidade separada reproduzida localmente no SDK 2.119.2 instalado:
Auth/REST sem sessão acrescentam fallback `Authorization: Bearer` com API key opaca.
O transporte scopedFetch do executor agora remove esse fallback somente quando a
chave opaca corresponde exatamente a apikey; bloqueia divergências, preserva JWT
real de usuário e JWT legado e define User-Agent explicitamente de Node. Não houve
alteração em node_modules, no aplicativo, na Edge Function ou em credenciais.

apiKeyHeaders fornece os cabeçalhos do futuro GET avulso: apikey, Accept e User-Agent,
sem Authorization. GET /auth/v1/settings é leitura de configurações públicas do
Auth, útil para observar aceitação da API key no gateway; não prova privilégios
administrativos nem acesso exclusivo em todos os outros projetos.

Próxima verificação depende de nova autorização: um único GET não destrutivo com
chave atual, via apiKeyHeaders + scopedFetch e destino aprovado. Não gerar nem
pedir outra chave antes desse diagnóstico. Nenhuma chamada Supabase foi feita
nesta investigação. O preflight offline não valida o valor da chave no servidor.

Fontes oficiais:
- https://supabase.com/docs/guides/getting-started/api-keys
- https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys
