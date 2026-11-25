# Inspeção do principal e bloqueio preventivo de implantação

## Homologação

O responsável homologou a RC 2adbe1f4860424f8d92634c89840266f3f52e059 no Samsung Galaxy S23 Ultra: 13 testes físicos aprovados, abrangendo inicialização, login/restauração, dados anteriores, fotos, mapa, câmera/GPS, detalhes, edição/exclusão de relato de teste, Perfil/privacidade, cancelamento de exclusão, sessão e logout/login.

## Identidade e operações executadas

A URL lida de .env.local corresponde a falaai-prova3, Ref wxmsqhmifqvtrlgosrjp. O nome/Ref foram confirmados pelo catálogo remoto de projetos (Management API da CLI autenticada), não por inspeção visual do painel. O descartável falaai-lgpd-validacao tem Ref ilkprwaxszztejsasmcs e não foi acessado nesta rodada.

Foram feitas exclusivamente leituras: catálogo PostgreSQL, contagens, metadata de usuários sem e-mails/senhas, lista de funções, disponibilidade de backups, settings públicos Auth e logs Auth recentes. Evidências privadas ficam em .artifacts/main-inspection, ignorado pelo Git. Inventário não é backup restaurável. .env.local, descartável e conta B não foram modificados.

## Estado observado

| Item | Principal |
| --- | --- |
| Auth / perfis | 2 / 2; nenhum perfil órfão |
| Ocorrências | 1 |
| photo_path preenchido | 0 |
| Registros de fotografia / objetos no bucket | 0 / 0 |
| Tabelas de aplicação | profiles, occurrences, occurrence_photo_files, RLS habilitado |
| Políticas | 15, nomes esperados de 001/002, sem nomes adicionais |
| Triggers de aplicação | 4 esperados, habilitados |
| Funções de aplicação | 9, corpos iguais aos arquivos locais 001/002 após normalizar espaços |
| Índices esperados | todos encontrados |
| Restrições do registro de fotos | 4 |
| Privilégios | leitura autenticada nas três tabelas, DELETE em occurrences; INSERT/UPDATE só nas colunas previstas; display_name atualizável no próprio perfil via RLS |
| Bucket | occurrence-photos, privado, 5242880 bytes, JPEG/PNG/WebP |
| Migração 003 | objetos LGPD ausentes |
| Edge Functions | nenhuma implantada |

A leitura de information_schema não expôs grants nessa sessão de inspeção; os ACLs foram conferidos diretamente em pg_class/pg_attribute e pg_proc. Há evidência estrutural de 001/002 aplicadas, sem necessidade de reaplicação. Isso não é uma nova execução de testes funcionais ou de RLS com usuários comuns. Expressões das políticas, FKs, colunas, índices e corpos das funções foram inventariados para revisão; não se afirma execução de todo o verificador do descartável no principal.

Diferenças esperadas para o descartável homologado: principal ainda em 001/002, sem tabelas/guards/RPCs LGPD, sem função delete-account e com dados reais diferentes. Não confundir os relatos/fotos criados no teste isolado Samsung com o inventário do principal: aqui só há uma ocorrência sem foto.

## Impedimentos — implantação NÃO executada

1. Compatibilidade dos clientes ativos não comprovada. A aplicação não registra versão de cliente por sessão; logs/metadata não permitem garantir ausência de versões antigas. Nenhum dos dois usuários possui metadata de aceite atual, mas isso NÃO prova versão antiga ativa nem autoriza aceite retroativo. A RC homologada comprova um cliente, não todos os que podem cadastrar.
2. Recuperação não comprovada. A API retornou zero backups listados e PITR false. Metadata do mecanismo físico/WALG não equivale a um ponto de recuperação disponível. pg_dump/psql não foram encontrados no PATH. Nenhum dump restaurável ou restauração foi produzido/testado. Não instalar ferramentas ou contratar plano sem decisão explícita.

Não houve DDL, migração 003, deploy, alteração de flags ou usuários/dados. Não há HTTP 503 da delete-account no principal a validar, pois a função não existe. Não anunciar implantação concluída ou exclusão habilitada.

## Solução mínima para liberar a implantação

- Confirmar o universo de clientes de teste/usuários autorizados e que todos os clientes usados para novos cadastros estão na RC com checkbox/metadata. Se houver cliente antigo que precise cadastrar, manter o principal como está e preparar transição separada. Login de usuários antigos é compatível; novo signup sem aceite não é.
- Obter backup lógico completo adequado, incluindo Auth e definições/RLS/ACLs, por ferramenta confiável e guardar fora do Git; conferir restauração em ambiente separado antes de alterar o principal. Se usar backup gerenciado, confirmar ponto disponível e procedimento real de restauração. Backup SQL não inclui bytes do Storage; este inventário está sem arquivos, mas recontar imediatamente antes da mudança.
- Com essas condições comprovadas, aplicar 003 uma vez e validar estrutura em banco populado, verificando que os dois usuários preexistentes não ganharam consentimento. Depois implantar função com Ref explícito e flag false, conferir runtime e 503 disabled. A allowlist do app ainda bloqueia exclusão no principal: nenhuma ativação implícita.

## Envio de e-mail

GET /auth/v1/settings retornou 200: provedor email habilitado, signup permitido, confirmação obrigatória (mailer_autoconfirm=false). A consulta às últimas 24h de logs retornou zero entradas; não há evidência de rate limit ou restrição de destinatário nesse recorte. Isso não comprova capacidade de entrega nem a configuração de SMTP; não foi enviado e-mail nem consultada senha SMTP.

Caminho mínimo: conferir SMTP no painel; se o remetente padrão restringir destinatários, usar caixa real autorizada do responsável/equipe. Fazer UMA tentativa com endereço novo acessível, aceite válido e confirmação pelo link. Não usar example.com nem confirmação Admin. Se ocorrer 429, respeitar janela e ler o código dos logs, sem repetir automaticamente. Para destinatários fora do permitido, usar SMTP próprio com remetente/domínio verificado, com autorização e possíveis custos. Não desabilitar confirmação global.

Fontes: https://supabase.com/docs/guides/auth/auth-smtp ; https://supabase.com/docs/guides/auth/rate-limits ; https://supabase.com/docs/guides/platform/backups .

## Roteiro final no Samsung, após liberar as pré-condições

1. Encerrar Metro isolado e app; iniciar Metro normal com .env.local principal preservado. Conferir o nome/ref no executor antes de operar, sem mostrar credenciais.
2. Login existente, reiniciar, conferir sessão, ocorrência anterior e ausência de perda de dados.
3. Novo cadastro em caixa real, checkbox inicialmente desmarcado, bloqueio sem aceite, envio único com aceite e confirmação real; login e persistência. Sem migração 003, checkbox cliente não prova registro servidor do aceite.
4. Criar relato dedicado com GPS/foto, reiniciar e consultar Home/Mapa/Detalhes/Perfil, editar foto/texto e excluir só esse relato autorizado.
5. Testar RLS por sessões comuns de duas contas dedicadas: leitura comunitária e bloqueio de edição/exclusão/foto alheia; somente fixtures novas autorizadas, não os registros existentes.
6. Após 003 e deploy desabilitado: consultar privacidade, abrir/cancelar exclusão e confirmar resposta disabled sem encerrar sessão. Exclusão real não está autorizada nesta rodada.

## Entrega

A versão obrigatória homologada continua preservada. Bônus demonstrado no descartável deve ser descrito como tal. Para GitHub: revisar estes documentos, diff/segredos, autorização para checkpoint/publicação e PR/checks; sem push nesta rodada. Apresentação pode usar a RC e evidências homologadas, sem inventar implantação no principal. Nenhum teste local foi repetido porque esta rodada não alterou código executável.

## Atualização: clientes ativos

O responsável confirmou ser o único usuário, sem distribuição a terceiros, com Samsung exclusivamente na RC atual. O impedimento de compatibilidade está resolvido por essa declaração. O backup/recuperação continua pendente; procedimento proporcional em PROVA-III-BACKUP-E-AUTORIZACAO-FINAL.md. Nenhum sistema de versionamento será criado para isso.
