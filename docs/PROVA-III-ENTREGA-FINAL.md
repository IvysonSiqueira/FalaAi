# Entrega final — 27/11/2026

## Decisão

Utilizar falaai-lgpd-validacao, ilkprwaxszztejsasmcs, homologado. Principal preservado em 001/002; 003 adiada. Nenhum projeto será pausado/excluído nem plano pago contratado. O limite gratuito de dois projetos foi informado pelo responsável. Backup do principal preservado localmente, íntegro/decodificado; recuperação real não comprovada.

## Configuração e conta de avaliação

O lançador `node scripts/start-academic.cjs` lê SOMENTE `.env.academic.local` com URL e Publishable Key. O arquivo foi preparado localmente, ignorado/bloqueado no Metro. Não lê arquivos administrativos nem altera `.env.local`. A flag de interface não altera a trava remota. Professor segue README, instala o Development Build existente e recebe configuração pública e credencial da conta dedicada separadamente, por canal privado. O responsável ainda precisa fornecer o APK/link oficial já validado; nenhum APK foi gerado ou publicado nesta rodada.

Conta dedicada criada no ambiente de entrega, com confirmação administrativa e metadata válida; login pela API pública e aceite do servidor conferidos. Credenciais somente em `.env.academic-account.local` (0600, ignorado e bloqueado pelo Metro). Não publicar esse arquivo, senha, token, e-mail de avaliação ou URL assinada nos vídeos/GitHub. B e seus relatos não foram modificados. Confirmação Admin NÃO comprova fluxo público de e-mail.

A criação dessa conta foi a única operação de escrita remota desta preparação. GET da Edge retornou 503 disabled. Nenhum deploy/migração/exclusão/alteração de flag foi realizado.

## Exclusão real: procedimento de demonstração controlada

RLS e a Edge impedem escolher outro proprietário; a função usa somente a identidade do JWT e exige a senha dessa identidade. Saber uma conta não permite excluir B. Entretanto, com a flag remota global true, QUALQUER usuário que conheça a própria senha pode excluir a própria conta. A flag não é allowlist por conta; não prometer proteção seletiva inexistente. Não distribuir credenciais de B para demonstração destrutiva.

Caminho mínimo: usar gravação/evidências da exclusão já homologada e deixar o servidor disabled. Para nova gravação ao vivo, ainda é necessária autorização explícita para:

1. Criar UMA conta descartável específica de exclusão, diferente de B e da conta estável do professor. Registrar seu UUID e inventário; somente ela será excluída.
2. Criar relato/foto dessa conta para a demonstração e registrar referência de B antes/depois, sem alterar B.
3. Habilitar ACCOUNT_DELETION_ENABLED=true apenas no descartável durante a janela acompanhada. O responsável autentica a conta específica no Samsung, mostra senha incorreta rejeitada, cancela e depois confirma com senha correta.
4. Imediatamente restaurar false, confirmar 503 disabled e conferir ausência de Auth/perfil/aceite/relatos/fotos/trabalhos da conta específica e preservação de B.

Não reutilizar cegamente `verify-lgpd-samsung.cjs after`: ele se refere ao UUID histórico de A. Para outra conta, o inventário/validação devem identificar explicitamente o novo UUID. Não executar a suíte destrutiva antiga em ambiente agora populado. Se o professor precisar operar exclusão, combinar essa janela e credencial específica por canal privado, sem deixar true indefinidamente. Não há alteração de funcionalidade para resolver isso.

## Roteiro da gravação

| Ordem / ação no Samsung | Código / conceito no VS Code | Critério demonstrado |
| --- | --- | --- |
| 1. Apresentar Login, Home, Mapa, Perfil e abas; abrir detalhes e voltar | screens e AppNavigator | telas, Stack/Tabs, consistência visual/usabilidade |
| 2. Entrar com conta dedicada, reiniciar e recuperar sessão | auth.ts, supabase.ts, AppContext | Auth real, persistência/renovação e logout |
| 3. Mostrar cadastro, aviso, checkbox desmarcado e bloqueio sem aceite | LoginScreen, privacy.ts, migração 003 | bônus de privacidade; declarar envio público de e-mail ainda pendente |
| 4. Criar relato com categoria, câmera/galeria e GPS | NewReportScreen, occurrence-media | Create, validações e recursos nativos |
| 5. Home/indicadores e mapa com marcador/filtro, detalhes | HomeScreen, MapScreen, occurrence-map.native | Read, FlatList, navegação e coordenadas reais |
| 6. Reiniciar, recuperar relato/foto, editar texto/substituir imagem | occurrences, occurrence-store, occurrence-photos | persistência banco/Storage e Update integrado |
| 7. Excluir somente o relato dedicado e conferir telas | confirmação e serviço CRUD | Delete, sincronização e limpeza de foto |
| 8. Perfil: aviso, Excluir minha conta e cancelar | account-deletion-panel, account-deletion.ts | clareza, reautenticação e cancelamento |
| 9. Mostrar gravação homologada ou nova janela autorizada de exclusão | Edge core/index, RPCs da 003 | remoção real/recuperável e sessão limpa; nunca excluir B |
| 10. Explicar RLS, grants e fotos privadas; testes e pastas | migrations 001/002/003 e tests | segurança servidor, organização, tipagem e qualidade |

Não gravar arquivos .env, dump, evidências privadas, senhas, tokens ou URLs assinadas. Os pesos/critérios oficiais específicos da Prova III devem ser conferidos no enunciado; os pesos da Prova II não são automaticamente os mesmos. Separar vídeo Samsung da explicação VS Code se simplificar. Nenhum vídeo foi gravado automaticamente.

## Pendências declaradas

- Migração LGPD do principal adiada por decisão de entrega.
- Restauração real do backup não comprovada; índice e decodificação não equivalem a restore.
- Cadastro público com aceite/confirmação e-mail no descartável pendente. Usar caixa real autorizada e uma tentativa controlada; confirmar Admin não substitui envio. SMTP próprio só se necessário e autorizado.
- Falha Deno real injetada/espera real de 24h não executadas. Não confundir simulações com testes remotos.
- Não há bloqueio técnico conhecido para executar a versão homologada com conta dedicada; instalação/link do Development Build e configuração pública precisam ser entregues privadamente.

## Git e publicação — sem execução remota nesta rodada

O histórico alcançável foi varrido localmente: 223 blobs antes do commit final, sem correspondências de valores privados locais conhecidos, padrões de Secret key fora de testes ou caminhos privados versionados. Isso não prova ausência de segredo desconhecido nem implica revogação de chaves anteriormente expostas fora do Git. .env.example vazio é o único exemplo versionável; .env.*, .artifacts, dumps e credenciais reais permanecem ignorados e bloqueados no Metro. Não incluir o backup no PR.

Após autorização de publicação:

```sh
git fetch origin
git status --short --branch
git log --oneline origin/main..codex/prova-iii-supabase
git diff --stat origin/main...codex/prova-iii-supabase
git push -u origin codex/prova-iii-supabase
```

Abrir PR para main e conferir commits, arquivos, segredos, checks e conflitos. Só integrar após autorização/revisão, sem force push, reset ou rebase automático. Como há outras worktrees, não trocar main nem integrar no projeto original sem conferir sua árvore limpa e obter autorização específica. Se origin/main tiver avançado, parar e analisar; não presumir fast-forward. Ao integrar, verificar a página principal GitHub, README e testes presentes, e entregar link com acesso ao professor. Não misturar migração de banco com publicação de código.
