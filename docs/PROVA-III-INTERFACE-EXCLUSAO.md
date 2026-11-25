# Interface LGPD — implementação e validação controlada

25/11/2026. Worktree e8ce, branch codex/prova-iii-supabase.
Checkpoint anterior às mudanças de interface: **bbe4cfd** (27 arquivos de
preparação/testes/documentação, sem ambientes, credenciais ou temporários da CLI).
O checkpoint 46b9d6c também permanece no histórico. Nenhum push.

## O que foi implementado

Perfil permite consultar o aviso/versionamento já utilizado no cadastro e oferece
Excluir minha conta. No principal o botão permanece desabilitado. No ambiente
isolado abre confirmação com aviso irreversível, senha atual, cancelamento antes
do envio, ações destrutivas diferenciadas, regiões de feedback acessíveis e tela
rolável com tratamento de teclado. Back/Cancelar não encerram a operação durante
o envio; após pendência é possível fechar e retomar depois.

A senha existe apenas como entrada transitória: é apagada do campo no envio,
cancelamento, perda de foco da tela e background. Não entra no AppContext, estado
do fluxo, AsyncStorage, manifesto, logs ou Git. JavaScript não oferece garantia de
zerar strings fisicamente da memória; a senha precisa transitar na requisição HTTPS
para reautenticação. Não há chave administrativa no bundle.

Serviço dedicado usa Publishable Key + JWT da sessão, POST para o endpoint fixo do
projeto autorizado, sem UUID no corpo e sem redirecionamentos. Guarda síncrona no
fluxo e no serviço impede duplo clique/solicitação paralela do mesmo cliente.
Tempo máximo de espera de 45s; timeout/perda de resposta são resultado incerto.
Não há retry automático de exclusão: o usuário retoma explicitamente com senha.

| Contrato real | Tratamento no aplicativo |
|---|---|
| 200/deleted | Confirmação única suficiente para limpar sessão/caches e ir ao login |
| 202/pending | Informa andamento/janela de até 24h; mantém sessão e oferece retomada |
| 401 | Valida usuário pelo Auth; sessão válida indica falha de reautenticação; sessão rejeitada não comprova exclusão |
| 503/disabled | Informa recurso desabilitado; não declara sucesso |
| 503/retry_required | Informa limpeza recuperável; conserva sessão |
| 503/configuration_required | Informa configuração pendente no servidor |
| Rede, timeout, JSON/estado inesperado | Resultado incerto, sem logout nem sucesso antecipado |

Se a resposta final se perder e a retomada encontrar sessão inválida, o app não
inventa um comprovante de exclusão. Oferece nova tentativa ou saída local explícita
sem confirmar exclusão. O Auth pode encerrar sessão inválida por conta própria;
isso também não gera mensagem de exclusão concluída.

Depois de 200/deleted, signOut(scope:local) do SDK 2.119.2 remove a persistência
local antes de tentar revogar pela rede. O serviço confere getSession sem sessão
antes de confirmar limpeza. Se isso falhar, permite concluir somente a limpeza
local, sem repetir exclusão remota. AppContext descarta store, dados de ocorrências,
serviço de fotos, avisos, perfil e sessão; callbacks antigos do store são invalidados.
A navegação existente desmonta as telas privadas e volta ao login. URLs assinadas
ficam nos componentes e são descartadas com sua desmontagem. Nenhum armazenamento
local de ocorrências foi introduzido. Isso não promete apagar caches internos de
imagem do sistema, backups do provedor ou cópias já salvas por terceiros.

No retorno ao Perfil, em modo habilitado, o app consulta apenas a solicitação do
próprio usuário para recuperar a indicação de pendência após reiniciar. Falha nessa
consulta é tratada como incerteza. No principal essa consulta nem é feita.

## Arquivos desta rodada

- src/services/account-deletion.ts: serviço, contrato, ativação, fluxo e limpeza local.
- src/components/account-deletion-panel.tsx: aviso, confirmação e retomada.
- src/context/AppContext.tsx: integração dos serviços e descarte dos dados da conta.
- src/screens/ProfileScreen.tsx: painel no lugar do aviso indisponível anterior.
- src/types/database.ts: tipos somente leitura das duas tabelas LGPD.
- scripts/start-lgpd-ui.cjs e scripts/helpers/lgpd-ui-env.cjs: Metro isolado.
- tests/account-deletion-client.test.cjs e tests/lgpd-ui-env.test.cjs: 25 testes novos.
- .env.example: flags públicas desabilitadas por padrão, sem credenciais.
- .gitignore: ignora supabase/.temp/ da CLI.
- README.md e este roteiro: estado e procedimentos atualizados.

Nenhuma dependência do projeto, configuração nativa, migração ou Edge Function foi
alterada. O Development Build existente é suficiente; não requer APK novo.

## Verificações e limites

- 134 testes locais aprovados (109 anteriores + 25 novos): cancelamento, senha,
  200/202/401/503, timeout, perda de resposta, retomada, duplicidade, limpeza do SDK
  com storage em memória, guardas de destino e isolamento do ambiente Metro.
- TypeScript sem emissão aprovado; git diff --check aprovado.
- Exportação JS Android e web em /tmp: verifica compilação/empacotamento, não substitui
  teste visual/interativo no Samsung. Nenhum APK/EAS Build executado.
- Expo install --check: mapa local do SDK indica dependências atualizadas; comando
  avisou modo offline, portanto não é verificação online nem do runtime físico.
- ESLint executado com versões fixas em cache temporário, sem editar dependências:
  eslint 9.39.5 + eslint-config-expo 57.0.2. Código atual: 5 erros e 3 avisos.
  Comparação em memória com bbe4cfd: 5 erros e 5 avisos. Todos os erros já existiam
  (set-state-in-effect em AppContext, stored-report-photo, use-color-scheme.web e
  NewReportScreen). Avisos restantes: imports duplicados MapScreen e dependência
  de hook ReportDetailScreen. Nenhuma regra foi suprimida. A tarefa não fez uma
  refatoração geral dos efeitos de autenticação/CRUD para esconder esse baseline.
- ESLint não está instalado/configurado permanentemente no projeto; a execução
  utilizou cache npm temporário. npm run lint não deve ser anunciado como aprovado.
- Sem acesso remoto, exclusão, alteração da flag do servidor ou criação de contas
  nesta rodada. O endpoint continua na condição desabilitada restabelecida antes.
- UI nativa, teclado/fonte ampliada, leitor de tela e limpeza entre telas aguardam
  validação no Samsung. Testes do fluxo não equivalem a testes de renderização RN.

## Teste mínimo no Samsung — sem mudar .env.local

1. Na raiz, executar a checagem offline:

   ```sh
   node scripts/start-lgpd-ui.cjs --check
   ```

2. Encerrar manualmente qualquer Metro anterior com Ctrl+C. Não iniciar dois.
   Fechar completamente o FalaAí no Samsung antes de alternar de projeto: Fast
   Refresh não é suficiente para substituir o cliente Supabase singleton.
3. Iniciar somente o ambiente isolado:

   ```sh
   node scripts/start-lgpd-ui.cjs
   ```

   O lançador lê URL/Publishable Key de .env.lgpd-validacao.local, ignora dotenv
   automático e passa ao Metro apenas variáveis públicas necessárias. Não repassa
   Admin Key nem token CLI. Recusa outro Expo/porta 8081 ocupada. Não habilita a
   função remota, não cria contas e não modifica arquivos de ambiente.
4. Abrir pelo Development Build existente com Samsung e Mac na mesma rede.
   As sessões são separadas por storageKey do Project Ref. Não usar credenciais
   antigas de A nem supor que contas do principal existem no descartável.
5. Como as fixtures anteriores foram removidas, utilizar uma conta de teste nova
   no descartável, com e-mail sob seu controle aceito pelo provedor e confirmação.
   Cadastro deve marcar aceite. Não fornecer senha pelo chat. O cadastro fictício
   anterior foi bloqueado por EMAIL_ADDRESS_INVALID; confirmar via Auth Admin não
   valida entrega SMTP. Não contornar o trigger de aceite criando conta sem metadata.
6. No Perfil, conferir aviso completo, versão, contraste, quebra de linha e leitura
   com fonte ampliada. Abrir exclusão, digitar senha, cancelar e reabrir: campo vazio.
   Testar teclado, rolagem, botão Android Voltar e leitor de tela.
7. Com função remota ainda false, enviar confirmação retorna disabled e preserva a
   conta/sessão. Verificar bloqueio de duplo toque e limpeza do campo no background.
   Não há autorização nesta rodada para habilitar o servidor ou excluir contas.
8. Teste destrutivo futuro exige autorização específica de habilitação temporária
   no descartável e fixtures. Validar senha incorreta, 202/retomada, rede desligada,
   resposta perdida, 200/retorno ao login e ausência de dados ao reabrir. Conferir
   preservação de outra conta e restaurar false ao concluir. Não reduzir a janela
   de recuperação nem usar o projeto principal para esse teste inicial.
9. Para voltar ao principal, Ctrl+C, fechar o app completamente e iniciar:

   ```sh
   npx expo start --dev-client --clear
   ```

   Esse novo processo volta a ler o .env.local original. A guarda compilada recusa
   exclusão no principal mesmo se alguém definir a flag pública por engano.

## Sequência segura de implantação principal — NÃO executada

1. Revisar o inventário/migrações realmente aplicados no principal por operação
   aprovada e preparar recuperação/backups do projeto. Não inferir igualdade com
   o descartável e não reaplicar 001/002 que já estejam aplicadas.
2. Distribuir e validar primeiro o cliente com checkbox/metadata de aceite, aviso e
   interface de exclusão ainda desabilitada. Confirmar a versão em todos os clientes
   usados na avaliação. Não registrar aceite retroativo.
3. PONTO DE BLOQUEIO: a 003 atual exige aceite em todo novo INSERT no Auth. Contas
   antigas continuam podendo entrar, mas versões antigas sem metadata NÃO poderão
   cadastrar novas contas após a migração. Não há como exigir um aceite que o cliente
   antigo não coleta sem mudar a compatibilidade. Se houver clientes antigos ativos
   que não podem ser atualizados, NÃO aplicar essa 003: preparar e validar antes
   uma estratégia explícita de transição (aceite pendente e coleta na atualização),
   sem inventar consentimento. Esta rodada não altera a migração validada.
4. Somente com clientes compatíveis confirmados e autorização, aplicar a migração
   LGPD no principal uma vez e executar o verificador adaptado ao ambiente real:
   contagens não serão zero e usuários antigos não devem receber aceite automático.
   Testar login antigo e cadastro novo com e sem aceite. Não usar o executor que
   tem o principal bloqueado nem um verificador de ambiente vazio como aprovação.
5. Autorizar e implantar a Edge Function no Ref principal EXPLÍCITO com flag false,
   conferir credenciais no runtime e validar 503/disabled. Não reutilizar comandos
   com o Ref descartável nem copiar Admin Key para o app.
6. Fazer revisão de código para incluir o Ref principal na allowlist local, ainda
   com flag de UI false; isso é uma liberação futura separada, não desta entrega.
7. Autorizar teste controlado com conta nova dedicada no principal, ativação curta,
   encerramento false, checagem de dados e sessão. Só liberar a UI e o servidor ao
   público após aprovar os resultados. Em falha, desabilitar servidor/UI; trabalhos
   pendentes devem ser preservados e retomados, não apagados manualmente.

Fontes consultadas: https://docs.expo.dev/guides/using-eslint/ e
https://docs.expo.dev/more/expo-cli/. Contrato e limpeza do SDK conferidos no código
instalado @supabase/supabase-js 2.119.2/@supabase/auth-js e no adaptador implantado.
