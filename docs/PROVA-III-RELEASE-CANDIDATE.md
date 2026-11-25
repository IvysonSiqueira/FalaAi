# Release candidate — Prova III

Escopo congelado. Base 390747ad9fe6965bb5ffbed8a68b24d308ec716d.

## Correções de qualidade

- AppContext: carregamento inicial vem do estado inicial; retry limpa erro e ativa carregamento no evento. Erro de configuração do cliente é derivado da inicialização, sem setters síncronos no efeito. Sem sessão, o perfil visível continua condicionado ao UUID e a transição Auth limpa caches.
- Foto privada: solicitação isolada por chave caminho/tentativa; renovação ou retry remonta apenas a solicitação, preservando timer, AppState e cancelamento de callbacks antigos.
- Edição: formulário isolado por conta/UUID, loading inicial e retry explícito. Não altera validações, permissões ou fluxo de envio.
- Tema web: useSyncExternalStore com snapshot servidor estável e tema nativo após hidratação.
- MapScreen: imports React unificados. Detalhes: identidade explícita da consulta inclui tentativa, preservando recarga sem dependência artificial.
- Nenhuma regra suprimida, pacote atualizado ou dependência nativa adicionada. Layout, textos e fluxos de navegação permanecem.

## Revisão

Pastas src/{screens,components,services,context,lib,navigation,types} mantidas. Não se removeu componente por mera ausência no fluxo principal: componentes do template podem ter consumidores internos. Nenhuma refatoração de arquitetura, persistência ou autenticação.

Mensagens Auth são traduzidas sem expor mensagens brutas; exclusão mantém senha apenas na operação, sessão autenticada e Public Key. Storage usa caminhos privados e URLs temporárias. Tipagem verificada com tsc estrito. Metro bloqueia .env, evidências, testes e scripts; credenciais administrativas são somente do executor/servidor. Mensagens operacionais dos scripts não fazem parte da UI. Arquivos .env locais e .artifacts continuam ignorados.

## Implantação principal — somente plano

1. Autorizar inventário de migrações, triggers/RLS, Storage, usuários, permissões e versão dos clientes. Registrar estrutura e preparar backup/recuperação do banco e objetos Storage conforme recursos do plano; validar acesso ao backup antes de DDL. Não supor que backup de banco inclui bytes do Storage.
2. Entregar primeiro cliente com aviso, checkbox desmarcado e metadata versão 2026-11-24-v1. Contas antigas não recebem aceite fictício. Login antigo continua permitido; a 003 bloqueia NOVOS cadastros de clientes antigos sem metadata. Se esses clientes precisarem cadastrar, parar e validar uma transição separada antes da 003.
3. Autorizar aplicação única da 003, após conferir 001/002, e validar com verificador adaptado a banco populado. Não usar as contagens zero do descartável como requisito no principal. Testar cadastro com/sem aceite e versão inválida, servidor definindo a data, login de usuário antigo.
4. Implantar Edge Function com Ref principal explícito e flag false; verificar credenciais no runtime e 503 disabled. A atual allowlist do aplicativo bloqueia o principal: liberar seu Ref exige revisão específica posterior, com UI inicialmente desabilitada.
5. Autorizar teste de conta específica nova no principal, janela curta de ativação e validação Samsung. Não usar B nem conta de apresentação com dados importantes. Inventariar antes/depois, restaurar false e verificar limpeza. Só então decidir liberação definitiva.
6. Contingência: desabilitar servidor/UI; manter trabalhos pendentes para retomada. Não apagar manualmente registros pendentes nem reverter SQL destrutivamente. Não remover exigência de aceite para acomodar cliente antigo sem um plano aprovado.

## Cadastro público e e-mail

Não aumentar limites nem desabilitar confirmação global. Primeiro aguardar a janela normal do serviço, conferir Auth logs/configuração e usar uma única conta nova com caixa real acessível ao responsável, respeitando as restrições do remetente padrão. Não usar example.com para comprovar entrega. Se persistir a limitação, configurar SMTP próprio com domínio/remetente verificado e limites adequados, mediante autorização e credenciais só no painel; envolve serviço externo e possíveis custos. Validar envio, link de confirmação e login; conta Admin confirmada não aprova esse cenário. Nunca publicar endereço pessoal, senha ou link de confirmação.

## Apresentação / critérios

Use PROVA-III-CONCLUSAO-MOBILE.md: Auth/sessão, CRUD persistido em todas as telas, Storage privado, RLS e bônus de aceite/exclusão. Stack/Tabs, FlatList, câmera, galeria, GPS e MapLibre permanecem como requisitos anteriores. Pesos da Prova III devem ser conferidos no enunciado oficial, não inferidos da Prova II.

Pré-requisitos: Node compatível (testes usam Node 24), npm ci, .env.local público conforme .env.example e Development Build já instalado. Iniciar `npx expo start --dev-client --clear`; Expo Go não contém os módulos nativos necessários. Para testes isolados usar `node scripts/start-lgpd-ui.cjs`, sem segundo Metro nem substituição do .env.local. Nenhum APK novo é necessário para estas alterações JS/TS.

## Checklist GitHub

- [ ] Conferir branch, diff, arquivos ignorados, ausência de segredos e estado remoto por fetch autorizado.
- [ ] Conferir README, instruções, migrações, testes e links de apresentação.
- [ ] Registrar checkpoint RC somente com verificações aprovadas; não incluir .env ou .artifacts.
- [ ] Obter autorização de publicação, enviar branch sem force push e abrir PR.
- [ ] Conferir checks/conflitos e autorização para integrar; verificar README e arquivos na branch principal do GitHub.
- [ ] Entregar links acessíveis ao professor até 27/11/2026. Não condicionar a entrega obrigatória à implantação do bônus no principal.

Os testes físicos anteriores comprovam o checkpoint anterior. Após os ajustes de efeitos, recomenda-se uma passada curta no Samsung: restauração/logout, retry de foto, edição e cancelamento da exclusão. Não repetir exclusão de B nem habilitar funções nesta rodada.

## Resultados executados nesta RC

| Verificação | Resultado |
| --- | --- |
| Testes Node completos | 143/143 aprovados |
| TypeScript sem emissão | aprovado |
| ESLint 9.39.5 + eslint-config-expo 57.0.2 | zero erros e zero avisos em src, App.tsx, index.js, app.config.js e metro.config.js |
| git diff --check | aprovado |
| Expo install --check | dependências atualizadas na matriz local; aviso de confiabilidade limitada por modo offline |
| Metro Android dev normal / lazy Hermes / source map | HTTP 200 / 200 / 200, 1195 fontes |
| Isolamento Metro | artefato JSON de regressão excluído, evidências reais presentes, nenhuma fonte interna/credencial conhecida no bundle; URL principal ausente no lançador isolado |
| Export Android | aprovado, bundle Hermes em /tmp/falaai-rc-android |
| Export web | aprovado em /tmp/falaai-rc-web |
| Varredura dos exports | 38 arquivos sem valores privados conhecidos ou artefatos LGPD |

ESLint foi executado do cache npm externo com configuração Expo temporária, sem editar package.json/lockfile, sem regras suprimidas. Não equivale a uma instalação permanente nem a aprovação de `npm run lint`. Os executores Node e Edge mantêm sua própria suíte; a inspeção ESLint acima cobre aplicação/configuração Metro/Expo.

Os bundles e exports não comprovam interação física após esta RC. Testes anteriores no Samsung continuam evidência do checkpoint anterior, e a passada curta recomendada valida os ajustes desta RC. Nenhuma chamada ao Supabase, migração, deploy, alteração de flag ou exclusão foi feita nesta rodada. O processo Metro existente foi reutilizado; exportações usaram seu próprio bundler de compilação sem abrir outro servidor de desenvolvimento.

A varredura é defesa contra valores privados conhecidos e padrões de artefatos, não prova matemática de ausência de todo segredo possível. Publishable Key e URL públicas são configurações esperadas no cliente. As credenciais administrativas permanecem externas ao aplicativo.
