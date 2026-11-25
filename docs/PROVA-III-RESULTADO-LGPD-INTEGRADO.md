# Prova III — resultado LGPD integrado no descartável

Execução em 25/11/2026. Projeto falaai-lgpd-validacao, Ref ilkprwaxszztejsasmcs.
Branch codex/prova-iii-supabase, worktree e8ce. Projeto principal não acessado.

## Resultado consolidado

24 cenários de cobertura: **21 PASSOU, 1 FALHOU por ambiente, 2 NÃO EXECUTADOS**.
Dos 21 aprovados, 20 são verificações reais e 1 é híbrido (interrupções sintéticas
no executor, RPC/Storage reais e retomada no endpoint real). Cenários agrupam
múltiplas asserções; não confundir com quantidade de requisições HTTP.

O cadastro público válido foi tentado, mas o provedor rejeitou o endereço fictício
com EMAIL_ADDRESS_INVALID. Embora o resumo original do executor o tenha rotulado
como não executado, este relatório conta conservadoramente a tentativa bloqueada
como FALHOU por ambiente. O executor foi ajustado localmente para essa classificação
e para explicitar os dois cenários sem execução remota; não foi necessário repetir
as operações remotas. Os registros originais foram preservados. Não atribuir
essa rejeição à cota SMTP sem evidência.

| Cenário | Resultado | Evidência / limite |
|---|---|---|
| Inventário inicial vazio e destino bloqueado para o principal | PASSOU | Condições verificadas sem exposição de dados |
| Cadastro público sem aceite rejeitado | PASSOU | Signup público recusado; Auth permanece vazio |
| Cadastro público com versão inválida rejeitado | PASSOU | Signup público recusado; Auth permanece vazio |
| Cadastro público com aceite válido e registro servidor | FALHOU — ambiente | Tentativa pública retornou EMAIL_ADDRESS_INVALID para endereço fictício; nenhum usuário foi criado por essa tentativa. Cadastro confirmado via Auth Admin foi testado separadamente. |
| Aceite: data enviada não substitui data servidor | PASSOU | Condições verificadas sem exposição de dados |
| Privacidade: usuário não escreve nem lê aceite alheio | PASSOU | Condições verificadas sem exposição de dados |
| CRUD próprio persistente e leitura comunitária | PASSOU | Condições verificadas sem exposição de dados |
| RLS: usuário não edita/exclui relato alheio nem muda proprietário | PASSOU | Condições verificadas sem exposição de dados |
| Storage: upload e leitura autenticada, bloqueio anônimo | PASSOU | Condições verificadas sem exposição de dados |
| Storage: usuário não modifica/exclui foto alheia | PASSOU | Condições verificadas sem exposição de dados |
| Registro de fotos: escrita direta e RPCs administrativas negadas | PASSOU | Condições verificadas sem exposição de dados |
| HTTP sem autenticação e JWT inválido rejeitados | PASSOU | Condições verificadas sem exposição de dados |
| HTTP senha incorreta e UUID alheio rejeitados sem efeitos | PASSOU | Condições verificadas sem exposição de dados |
| HTTP exclusão real com 0 fotos e segunda conta preservada | PASSOU | HTTP real 200; Auth/dados/arquivos ausentes e conta B preservada |
| HTTP exclusão real com 1 fotos e segunda conta preservada | PASSOU | HTTP real 200; Auth/dados/arquivos ausentes e conta B preservada |
| HTTP exclusão real com 100 fotos e segunda conta preservada | PASSOU | HTTP real 200; Auth/dados/arquivos ausentes e conta B preservada |
| HTTP exclusão real com 101 fotos e segunda conta preservada | PASSOU | HTTP real 202 → 200; Auth/dados/arquivos ausentes e conta B preservada |
| HTTP exclusão real com 250 fotos e segunda conta preservada | PASSOU | HTTP real 202 → 202 → 200; Auth/dados/arquivos ausentes e conta B preservada |
| RPC real: falha parcial e perda sintética de ACK com retomada | PASSOU | RPC/Storage reais + interrupções sintéticas no orquestrador; retomada HTTP 200 |
| HTTP concorrência e repetição com exclusão Auth real | PASSOU | HTTP concorrente: 503,200; repetição 401; outra conta intacta |
| Ausência final de fixtures órfãs | PASSOU | Condições verificadas sem exposição de dados |
| Cadastro confirmado via Auth Admin com aceite válido | PASSOU | Trigger real criou perfil/aceite; fixture confirmada sem envio SMTP |
| Falha de rede real dentro do runtime Deno | NÃO EXECUTADO | Não houve injeção de falha no código implantado. Interrupções sintéticas foram limitadas ao executor, com RPC/Storage reais e retomada HTTP. |
| Espera real de 24 horas de upload incerto | NÃO EXECUTADO | Janela não reduzida. Não foram criadas reservas que exigissem aguardar 24h; cobertura local não equivale à espera remota. |

## Segurança e encerramento

- Inventário inicial e final confirmaram zero Auth users, profiles, occurrences,
  occurrence_photo_files, privacy_acceptances, account_deletion_requests e objetos
  Storage. Nenhum dado preexistente foi usado ou removido.
- 8 contas e 555 caminhos de arquivos foram registrados em manifesto local
  ignorado pelo Git, com permissão 0600. Senhas/tokens permaneceram somente em
  memória. Nenhuma chave, hash de chave ou fragmento de credencial foi impresso.
- A conta B foi conferida durante todas as exclusões: identidade, aceite, relato
  e conteúdo binário da fotografia permaneceram intactos. B foi removida somente
  no cleanup final autorizado das próprias fixtures.
- Não sobraram fixtures, arquivos órfãos ou pendências de limpeza detectadas.
- ACCOUNT_DELETION_ENABLED=false foi restabelecida; HTTP 503/state disabled
  confirmado antes do cleanup. As duas flags locais continuam desabilitadas;
  autorizações de execução existiram apenas no processo, sem editar o arquivo
  de credenciais. Nenhuma migração, novo deploy ou push nesta rodada.

## Distinção de privilégios e tentativas preparatórias

A primeira tentativa parou antes de criar fixtures: service_role não possui
SELECT direto nas cinco tabelas public (HTTP 403, código 42501). Auth Admin e
Storage aceitaram a chave. Nenhum GRANT foi ampliado para contornar isso.
A observação administrativa foi adaptada para a CLI autenticada com Ref explícito
e transações --read-only; RLS/CRUD/Storage foram exercitados com sessões comuns.
As RPCs administrativas reais executam como SECURITY DEFINER, e o fluxo HTTP
completo comprovou sua operação sem leitura direta de tabelas pelo cliente admin.

Uma segunda tentativa parou no cadastro público válido, restaurou a trava e
confirmou inventário vazio. A execução final completou os demais cenários com
fixtures confirmadas via Auth Admin. Não somar tentativas de inventário e retries
como cenários independentes de sucesso. Não houve uso das credenciais antigas de A.

HTTP concorrente retornou 503 e 200; o estado final estava completamente removido,
e repetição com a sessão antiga retornou 401. Isso prova segurança de dados no
cenário testado, não uma promessa de retornar 200 para todas as chamadas repetidas.
A interface deverá tratar sessão encerrada e erros recuperáveis com clareza.

## Evidências locais e arquivos

- Manifesto: .artifacts/lgpd/53485b20-e132-4cd6-8a77-14ed57ccae1e/fixtures.json (ignorado; somente IDs/caminhos).
- Resultado original: .artifacts/lgpd/53485b20-e132-4cd6-8a77-14ed57ccae1e/results.json (ignorado).
- Executor: scripts/lgpd-real-disposable.cjs; guard: tests/helpers/lgpd-fixtures.cjs.
- Testes do guard: tests/lgpd-fixtures.test.cjs; red-green executado localmente.
- 109 testes locais aprovados, TypeScript sem emissão aprovado e git diff --check
  aprovado. Aplicativo, dependências, configurações nativas e migrações preservados.

## Próximo passo

Podemos preparar a interface de exclusão com controle de carregamento, confirmação,
reautenticação, retomada de 202/503 e encerramento de sessão. Manter ativação
controlada: este resultado valida o projeto descartável, não autoriza implantação
ou exclusão no falaai-prova3. Antes da ativação principal, revisar/aprovar destino,
migração e deploy próprios, e validar o fluxo no Samsung com conta descartável.

Para fechar o cadastro público, usar endereço de teste real sob controle do aluno
ou provedor SMTP/sandbox apropriado, configurado localmente sem senhas pelo chat.
Não considerar envio/confirmação de e-mail validado por contas confirmadas via API
administrativa. Para falhas internas reais do Edge e janela de 24h, manter os
limites acima explícitos; não enfraquecer regras nem acelerar prazos de limpeza.

Evidências arquivadas sem alteração de conteúdo na correção Metro; veja PROVA-III-CORRECAO-METRO-DEV.md.
