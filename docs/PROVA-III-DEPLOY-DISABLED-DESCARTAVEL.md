# Pendência SETOF e deploy desabilitado — 25/11/2026

A falha C de claim_occurrence_photo_cleanup() é do verificador: esperava a string
`setof text`, extraída literalmente da migração, enquanto pg_get_function_result
retorna `SETOF text`. A comparação SQL é sensível à caixa. O retorno é correto;
segundo o resultado remoto fornecido, o corpo também é exatamente o esperado.
Foi alterado somente o literal esperado para a representação do PostgreSQL,
sem normalização ampla, sem remover o critério de retorno e sem alterar a função.

Executar manualmente no SQL Editor do descartável, em consulta nova:
**supabase/tests/VERIFY_ONLY_003_claim_return_readonly.sql**.
Esperado: uma linha PASSOU, retorno_postgresql/retorno_esperado SETOF text,
retorna_conjunto/tipo_base_text/security_definer true, plpgsql e search_path vazio.
A consulta inspeciona proretset e prorettype, além do retorno textual, sem executar
RPC. Se falhar, parar. Opcionalmente repetir o verificador consolidado corrigido:
continuam esperadas 132 linhas, agora todas PASSOU. Não reaplicar migração.

## Futuro deploy mínimo — requer autorização específica, nada executado

1. Confirmar projeto falaai-lgpd-validacao, Ref ilkprwaxszztejsasmcs, e a pendência
   acima resolvida. Nunca usar o principal falaai-prova3.
2. Confirmar acesso da conta Supabase e CLI disponível. Não instalar Docker,
   não executar link, db push ou migrações. Se faltar CLI, aprovar sua obtenção antes.
3. Em Edge Functions → Secrets no projeto descartável, manter
   ACCOUNT_DELETION_ENABLED=false (ou ausente). Não exibir/copiar chaves para logs,
   chat, app ou arquivos versionados.
4. Conferir a disponibilidade das variáveis padrão do runtime SUPABASE_URL,
   SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY. O adaptador atual usa os valores
   JWT legados fornecidos pelo servidor, não os cinco campos do arquivo local
   .env.lgpd-validacao.local. Não sobrescrever variáveis reservadas SUPABASE_*.
   A Secret API key local aceita pelo gateway não comprova essas pré-condições.
   Se as chaves legadas estiverem desabilitadas/indisponíveis, parar para preparar
   suporte server-side às novas chaves e seus testes antes de habilitar a função.
   O ajuste apikey/sem Bearer de sb_secret_ existe no executor Node, não neste
   adaptador. Não colocar sb_secret_ em SUPABASE_SERVICE_ROLE_KEY como improviso.
5. Revisar config.toml: entrypoint ./functions/delete-account/index.js,
   verify_jwt=false. O endpoint verifica JWT de usuário com getUser e reautentica
   com senha no próprio código; clientes não escolhem UUID. Flag false bloqueia
   antes de qualquer autenticação/remoção. Chave administrativa fica só no servidor.
6. Após autorização de deploy, executar da raiz e com destino explícito:

   ```sh
   npx --yes supabase@3.4.0 functions deploy delete-account --remote=ilkprwaxszztejsasmcs --use-api
   ```

7. Após autorização separada de leitura/teste do endpoint, verificar boot/imports
   e resposta HTTP 503 com state disabled. Não interpretar 503 genérico como sucesso:
   confirmar o estado disabled; BOOT_ERROR é falha de runtime.
   Essa resposta não comprova autenticação, disponibilidade de chaves ou exclusão:
   com a flag false, o código retorna antes de ler as credenciais.
8. Manter flag false, botão do app indisponível e flags locais destrutivas desabilitadas.
   Planejar a etapa seguinte com autorização explícita para fixtures e exclusão
   somente no descartável. A suíte RPC não prova o endpoint Deno nem a exclusão Auth
   completa; esses testes continuam obrigatórios antes de considerar o bônus validado.

O runtime não foi inspecionado remotamente nesta rodada. O deploy pode ser preparado
com a função desabilitada, mas habilitação depende de compatibilidade de credenciais,
RLS A/B e testes reais de falhas, retomada, concorrência e preservação de outra conta.

Referências oficiais já consultadas:
- https://supabase.com/docs/guides/functions/secrets
- https://supabase.com/docs/guides/functions/deploy
- https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys


## Tentativa de preparação em 25/11/2026

Preflight offline aprovado; destino descartável e bloqueio do principal confirmados.
CLI global ausente. CLI fixa 3.4.0 executada via npx, sem instalação global/Docker.
Ajuda desta versão confirma --remote=<ref> (em vez de --project-ref) e --use-api.
A consulta filtrada de nomes de secrets parou por ausência de login; nenhum valor
ou digest foi impresso. Não foi possível confirmar variáveis do runtime, implantar
ou testar HTTP. Nenhuma conta foi criada e nenhum deploy foi tentado.

Passo manual pendente no Terminal:

```sh
cd /Users/ivysonsiqueira/.codex/worktrees/e8ce/FalaAi
npx --yes supabase@3.4.0 login
```

Seguir o fluxo de autenticação no navegador com a conta que tem acesso ao projeto
falaai-lgpd-validacao. Não usar a Secret API key como access token da conta e não
colar credenciais no chat nem em argumentos de comando. Login não faz link ou
deploy. Se houver solicitação de token pessoal, fornecê-lo apenas no fluxo local
seguro da CLI/painel. Depois do login, retomar a checagem de nomes dos secrets e da
flag desabilitada antes de executar o deploy já autorizado. Nenhuma confirmação
adicional é necessária para as operações dentro do escopo aprovado.

Validação desta rodada: 35 testes locais pertinentes aprovados; TypeScript e
 git diff --check aprovados. A existência de chaves padrão no runtime não foi
comprovada pela documentação nem pela chave local: permanece uma pré-condição
remota a conferir após autenticar a CLI.

## Implantação concluída — 25/11/2026 (substitui a pendência de login acima)

Após login manual da CLI, preflight novamente aprovado na branch
codex/prova-iii-supabase/worktree e8ce. Consulta filtrada somente dos nomes dos
secrets confirmou SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY.
Nenhum valor ou hash foi impresso. A flag inicialmente não existia; foi definida
explicitamente como ACCOUNT_DELETION_ENABLED=false no descartável.

CLI confirmou nome falaai-lgpd-validacao e Ref ilkprwaxszztejsasmcs. Deploy realizado:

```sh
npx --yes supabase@3.4.0 functions deploy delete-account --remote=ilkprwaxszztejsasmcs --use-api --yes
```

--yes satisfez a confirmação de alteração hospedada da CLI dentro da autorização
expressa do usuário; não habilitou exclusão ou flags de teste. Sem Docker, instalação
global, link permanente ou acesso ao projeto principal. Enviados index.js e core.ts.

Resultado: Deployed Functions, delete-account, Ref esperado. Painel:
https://supabase.com/dashboard/project/ilkprwaxszztejsasmcs/functions

Uma única chamada HTTPS GET ao endpoint, com Publishable Key em apikey, sem Bearer
administrativo e com redirecionamentos proibidos, retornou HTTP 503 e state disabled.
Não foi necessário criar conta ou autenticar usuário. Confirma boot/imports e
bloqueio no caminho inicial. NÃO prova que os valores das chaves administrativas
funcionam: a função retorna antes de usá-los. Essa compatibilidade operacional
permanece para os testes integrados autorizados com fixtures.

35 testes locais pertinentes passaram novamente e git diff --check passou.
Não houve migração, alteração de .env.local, contas, fotos, relatos ou push.
Flags locais destrutivas continuam desabilitadas; botão do app continua bloqueado.

Próxima etapa, com autorização específica para operações destrutivas no descartável:
1. Repetir preflight e conferir destino/flag antes de qualquer fixture.
2. Autorizar suíte RPC/Storage e criação/remoção apenas das fixtures do teste;
   habilitar suas duas flags locais somente nessa etapa e executar o runner seguro.
3. Preparar/rodar harness HTTP dedicado que teste token inválido, reautenticação,
   preservação de uma segunda conta, falhas parciais, retomada e exclusão Auth real.
   Ativar ACCOUNT_DELETION_ENABLED=true somente para essa validação autorizada e
   restaurar false ao final. A suíte RPC sozinha não valida esse endpoint.
4. Completar RLS A/B com contas confirmadas novas; só depois conectar o cliente e
   validar no Samsung. Não utilizar a senha antiga de A nem o projeto principal.

Bônus permanece não validado ponta a ponta. Não considerar deployment desabilitado
como comprovação da exclusão de conta ou de conformidade jurídica.
