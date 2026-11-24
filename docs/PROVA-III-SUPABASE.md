# Prova III — registro da Fase 2 (autenticação)

> Atualização: o CRUD foi validado no Samsung pelo responsável. A etapa local de
> fotografias está em [PROVA-III-STORAGE.md](PROVA-III-STORAGE.md); referências
> abaixo a foto apenas como prévia descrevem a entrega anterior ao Storage.
> **RLS A/B ainda NÃO validado.** Em 21/11/2026 às 12h41, o Supabase limitou os
> envios no cadastro de B; conta aguardando verificação. Retomar obrigatoriamente
> os testes remotos de CRUD e Storage após a integração de fotografias.

> Registro histórico da entrega de autenticação. O responsável validou cadastro,
> confirmação, login, persistência e logout no Samsung Galaxy S23 Ultra com o
> novo Development Build. A etapa seguinte já implementa CRUD remoto; para o estado
> atual, limitações de fotos e testes, consulte [PROVA-III-CRUD.md](PROVA-III-CRUD.md).
> As referências abaixo a relatos locais descrevem a Fase 2, antes do CRUD.

Prazo: 24/11/2026 às 23h59 (America/Maceio). Branch: `codex/prova-iii-supabase`.

## Estado e limites

O responsável confirmou o projeto `falaai-prova3` e a execução manual da migração
`20261121000100_initial_profiles_occurrences.sql`. Não reaplicamos SQL nem
alteramos políticas. A aplicação pelo SQL Editor não registra necessariamente o
histórico da CLI: reconciliar antes de adotar `supabase db push`.

Nesta rodada: cadastro, login, logout local, restauração e renovação da sessão,
leitura do próprio perfil e estados de carregamento/erro no AppContext e telas.
Sem credenciais demonstrativas nem contas/senhas em arrays. Não há CRUD remoto,
upload, LGPD ou alteração de design. MapLibre, GPS, câmera e navegação preservados.

O `.env.local` foi carregado pelo Expo e validado sem imprimir valores. A URL
informada terminava em `/rest/v1`; foi corrigida localmente para a raiz HTTPS do
mesmo projeto. A chave não foi alterada. O arquivo permanece ignorado. A consulta
GET pública de `/auth/v1/settings` retornou 200: Email habilitado, cadastro
habilitado e `mailer_autoconfirm=false` (confirmação obrigatória). Nenhum usuário
foi criado automaticamente para teste, nem foram consultados dados pessoais.

## Fluxo e arquivos

- `src/lib/supabase-config.ts`: valida URL padrão HTTPS e chave publishable; rejeita
  secret keys/JWT legado. `.env.example` tem somente nomes e valores vazios.
- `src/lib/supabase.ts`: cliente único, AsyncStorage, `persistSession`,
  `autoRefreshToken` e `detectSessionInUrl=false`. AppState controla renovação em
  primeiro plano, com limpeza do listener. Sem callback/deep link de confirmação.
- `src/services/auth.ts`: chamadas Auth, mensagens seguras e consulta de perfil.
  O callback de eventos só entrega a sessão; não aguarda consultas. Um evento
  novo prevalece sobre restauração atrasada; cleanup ignora respostas tardias.
- `src/context/AppContext.tsx`: restaura sessão antes de liberar navegação, busca
  perfil em efeito separado e usa UUID Auth. Respostas de perfil após logout são
  ignoradas. Logout/troca de identidade limpa relatos temporários.
- Login aguarda promises, bloqueia envio repetido e mostra confirmação, erros de
  credenciais, conta existente, limite e rede. Cadastro exige 8 caracteres.
  Senha não é normalizada nem persistida pelo app. Email é normalizado.
- Se o Auth ofuscar um cadastro existente, a mensagem é condicional, sem afirmar
  que uma nova conta foi criada. Cadastro sem sessão nunca libera as abas.
- Perfil encerra a sessão real neste dispositivo (`scope: local`) e trata falhas.
  Outros dispositivos continuam conectados. Access tokens já emitidos podem
  continuar válidos até a expiração; não prometer revogação instantânea de JWT.
- Falha ao obter perfil mostra tentativa novamente e saída; não cria um perfil
  fictício nem contorna RLS. O nome vem da tabela, não de privilégios em metadata.

## Persistência e segurança

Única solução de sessão: AsyncStorage 2.2.0. O SDK persiste tokens/sessão com chave
específica por projeto. Não guarda a senha. **AsyncStorage não é criptografado**;
esta escolha acadêmica não equivale a um cofre seguro. A Publishable Key é pública,
incluída no bundle, e não autoriza acesso administrativo. RLS é a barreira no banco:
`profiles` só permite consultar/alterar o próprio nome pelo UUID do token. O trigger
já versionado cria o perfil no cadastro. As políticas de `occurrences` ficam
preparadas para fases futuras e não são utilizadas para salvar relatos nesta fase.

Relatos/fotos/GPS continuam em memória/URIs do aparelho; reinício e logout apagam
relatos locais. Contas Supabase não são apagadas. Não há exclusão de conta/Storage.
Não copiar tokens, senhas ou secret/service_role para código, prints ou logs.

## Dependências e Development Build

Mantidos da Fase 1: Supabase JS 2.119.2, AsyncStorage 2.2.0, URL polyfill 4.0.0.
Nenhuma nova dependência nesta rodada. Expo 57, RN 0.86.3 e plugins inalterados.
Node >=22 para o SDK; testes locais usam Node 24. AsyncStorage coincide com o
catálogo Expo 57 instalado. A checagem online da Fase 1 apontou 15 recomendações
de patches de dependências preexistentes; não atualizar automaticamente.

**Novo APK é necessário se o instalado ainda é o da Prova II**, pois não contém
AsyncStorage. Código JS/Metro não adiciona módulos nativos. Não foi gerado APK.

Procedimento proposto, somente após autorização:

```bash
cd /Users/ivysonsiqueira/.codex/worktrees/e8ce/FalaAi
npx eas-cli build --platform android --profile development
```

Requer login na conta Expo com acesso ao projeto EAS existente, permissão para
usar o keystore Android existente, rede e quota/fila do EAS. Preservar applicationId
`com.ivysonsiqueira.falaai`; não gerar identidade/keystore diferente. O perfil já
usa `developmentClient: true` e distribuição interna. Instalar o APK pelo link EAS
no S23 Ultra e autorizar instalação dessa fonte quando o Android solicitar.
Nenhuma permissão Android adicional é necessária para AsyncStorage.

O `.env.local` não vai ao upload do Git/EAS; para testar com Metro, as variáveis
vêm do computador local. Para o JavaScript embutido no APK apontar para o projeto,
configurar no ambiente **development** do EAS as mesmas duas variáveis públicas
pelo painel (sem chaves privilegiadas). Isso deve ser confirmado antes do build.

Somente com o binário novo instalado e se não existir Metro ativo:

```bash
npx expo start --dev-client
```

Computador e celular precisam se alcançar na rede. Nesta execução não havia
Expo/Metro ativo na checagem inicial; não iniciamos servidor de desenvolvimento.
Os comandos de exportação apenas compilaram bundles para uma pasta temporária.
Não usar Expo Go para validar MapLibre nem o APK antigo para validar AsyncStorage.

## Roteiro Samsung Galaxy S23 Ultra

1. Antes: conferir Site URL real em Auth/URL Configuration, entrega de e-mails e
   limites/SMTP do projeto. O serviço de e-mail padrão pode restringir destinatários;
   configurar SMTP se necessário. Não inventar redirect URL nem desabilitar
   confirmação para contornar entrega. Login será manual após confirmar.
2. No novo build conectado ao Metro, abrir Criar conta. Usar nome, e-mail que você
   controla e senha exclusiva >=8. Testar vazio/inválido/7 caracteres. Botão deve
   mostrar carregamento e impedir duplo envio; teclado deve manter envio acessível.
3. Cadastrar. Deve continuar no fluxo Entrar, com orientação de confirmação. No
   painel Auth/Users, conferir conta não confirmada e em `profiles` o mesmo UUID.
   Não divulgar esses dados em capturas públicas.
4. Tentar entrar antes de confirmar: mensagem de confirmação, sem abrir abas.
5. Abrir e-mail/spam e o link. A página de retorno é a Site URL configurada; não
   há abertura automática do app. Depois voltar manualmente e entrar. Se a página
   de retorno falhar, conferir no painel se a confirmação ocorreu; corrigir URL.
6. Testar senha incorreta e e-mail já cadastrado. Mensagem deve orientar Entrar ou
   conferir caixa de entrada; não criar usuário duplicado. Respeitar limites.
7. Entrar corretamente. Home/Perfil devem usar seu nome. Navegar abas/mapa e criar
   um relato local para verificar ausência de regressão (não é CRUD Supabase).
8. Fechar totalmente o processo e reabrir com Metro disponível: sessão restaurada
   sem piscar formulário. Conta permanece; relatos locais somem, conforme aviso.
9. Deixar em segundo plano, retornar e repetir após a expiração configurada do
   access token: sessão deve renovar sem pedir senha. Isso exige teste prolongado;
   não alterar expiração no banco só para a demonstração. Não imprimir tokens.
10. Sair no Perfil: voltar para Entrar; Voltar não abre abas. Reiniciar: continuar
    desconectado. Entrar com outra conta: não mostrar relatos da anterior.
11. Desligar rede e tentar login/logout; verificar erro, fim do carregamento e
    tentativa novamente ao reconectar. Offline total não é suporte garantido: a
    sessão pode estar salva, mas o perfil ainda precisa de consulta ao servidor.
12. Se surgir falha de perfil, conferir trigger/perfil/RLS antes de mudar políticas.

## Verificações desta rodada

- TypeScript sem emissão e testes Node (serviço Auth mockado + configuração + base).
- Exportação Metro/Hermes Android e web, sem APK nem EAS Build.
- `.env.local` carregado/ignorado; `.env.example` versionável; `git diff --check`.
- Consulta remota não mutante de configurações Auth: 200.
- Não validado ainda: signup/login real no celular, recebimento/confirmação de
  e-mail, trigger/perfil/RLS com usuário real, persistência/renovação no novo APK.
  Testes mockados e bundles não comprovam esses comportamentos.

Comandos locais de validação:

```bash
./node_modules/.bin/tsc --noEmit --incremental false
node --test tests/*.test.cjs
git diff --check
```

O roteiro `supabase/tests/initial_rls.sql` não foi executado nesta rodada. Não
reexecutar a migração já aplicada. Sem commits, push ou alteração de outra worktree.

## Conceitos para explicar

Auth valida e-mail/senha e emite sessão (access token curto + refresh token).
O SDK persiste/renova a sessão; AppContext distribui usuário e estados assíncronos.
A navegação reage ao usuário restaurado, sem navegação manual após login. RLS
valida autorização no servidor a partir do UUID do token: esconder botão não
substitui política. `profiles` guarda dados de exibição, não senha. Autenticação
real não significa que o CRUD ou as fotos já estão no backend.

Referências: [Auth React Native](https://supabase.com/docs/guides/auth/quickstarts/react-native),
[senhas/confirmar e-mail](https://supabase.com/docs/guides/auth/passwords),
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
