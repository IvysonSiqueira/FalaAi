# Conexão de backup preparada

## Verificações executadas

- Worktree e8ce, branch codex/prova-iii-supabase.
- Executáveis absolutos /opt/homebrew/opt/libpq/bin/{pg_dump,pg_restore,psql}: versão 19.0.
- SELECT de leitura no principal: PostgreSQL 17.12 (170012).
- Host direto db.wxmsqhmifqvtrlgosrjp.supabase.co: DNS IPv6 e TCP 5432 acessível deste Mac. Não foi feita autenticação PostgreSQL, pois a senha ainda não foi preenchida. Não há necessidade de inventar host Pooler.
- brew info confirmou libpq@17 versão 17.12, keg-only, ainda não instalado. Nenhum pacote foi instalado automaticamente.

pg_dump 19 pode capturar servidor 17, mas o PostgreSQL não garante restaurar sua saída em versão principal anterior à do dump. Para recuperar no Supabase 17, preferir pg_dump/pg_restore 17; não usar o 19 como única garantia de recuperação. Fonte: https://www.postgresql.org/docs/19/app-pgdump.html .

## O que preencher

Arquivo local `.env.main-backup.local`, criado com permissão 0600, ignorado pelo Git e bloqueado pelo Metro. Somente `FALAAI_BACKUP_DATABASE_PASSWORD` está vazio. Inserir a senha original do BANCO dentro das aspas desse campo. Não preencher a URI com API key ou senha; o executor passa a senha separadamente, sem URL-encode necessário.

O leitor é util.parseEnv: não expande $, respeita # dentro de aspas e não executa shell. Se a senha contiver aspas duplas ou representar literal de escape ambíguo, escolher aspas simples se a senha não contiver apóstrofo, ou ajustar a representação local antes do preflight. Nunca usar source nem colocar a senha na linha de comando. O preflight não imprime os valores. Não redefinir a senha do banco.

Ref, servidor 17, host direto, usuário postgres, banco postgres, porta 5432 e TLS já estão configurados. O caminho foi preparado para o cliente 17, não para o libpq 19 instalado.

## Comandos

Instalar apenas o pacote de cliente compatível, sem servidor/Docker e sem substituir o pacote 19 (keg-only):

```sh
brew install libpq@17
node scripts/backup-main-postgres.cjs --check
```

Depois de preencher a senha e obter preflight aprovado, para executar a captura:

```sh
node scripts/backup-main-postgres.cjs --run
```

Não foi executado nesta rodada. `--check` é offline e foi bloqueado corretamente pela senha vazia. O script exige família 17 dos dois utilitários; `--run` é leitura do banco via pg_dump e cria apenas arquivos locais privados. Cópia consistente usa archive custom sem filtrar Auth, schemas, ACLs ou owners. Arquivo fica em `.artifacts/backups/<data>/principal.dump`, com índice e status separados, fora do bundle/Git. Quaisquer dados do Auth no arquivo são sensíveis.

A autenticação/TLS/permissões reais só serão comprovadas na conexão com a senha. O teste TCP não comprova login nem sucesso do dump. O preflight não é validação remota da senha. Nenhum arquivo de backup foi produzido até aqui.

Se o acesso IPv6 mudar, abrir Connect > Session pooler no painel do PRINCIPAL e copiar o host EXATO. Usar postgres.wxmsqhmifqvtrlgosrjp como usuário, porta 5432 (não transaction 6543), manter senha no campo separado. Não inferir host a partir da região. O executor já aceita esse formato; não alterar agora a conexão direta funcional.

## Comprovação de recuperação proporcional

Primeiro gerar e inspecionar o arquivo com clientes 17. `pg_restore --list` não escreve no servidor e é executado automaticamente, mas NÃO comprova restauração.

O ensaio de menor impacto sobre os ambientes existentes é um terceiro projeto Supabase temporário, vazio, PostgreSQL 17, SE houver vaga gratuita disponível. Não apagar B, não reutilizar o descartável homologado, não contratar plano nem criar conta adicional automaticamente para contornar limites. A autorização do destino e do ensaio deve anteceder qualquer restauração.

Revisar o índice e o plano oficial para evitar conflitos com Auth/Storage/extensões gerenciadas preexistentes; restaurar com ordem adequada e conferir dois usuários/identities, perfis, ocorrência, FKs, funções/triggers/RLS/ACLs e login com senha original. Comparar dados e UUIDs, não apenas contagens. Não executar pg_restore --clean às cegas. O archive não contém roles globais, configuração do provedor nem bytes Storage; esses itens têm procedimento separado. Recontar Storage antes da captura, mesmo tendo zero arquivos no inventário anterior.

Se não houver vaga gratuita, não há ensaio remoto totalmente isolado já disponível sem comprometer os dois projetos. A alternativa é um PostgreSQL 17 local temporário, mas exige servidor e preparação dos roles/extensões Supabase, portanto NÃO é o caminho mais simples nem foi instalado. Nesse caso, registrar o limite da validação em vez de chamar listagem de índice de restauração comprovada.

Sem teste de restauração, ainda pode existir uma cópia lógica inspecionada com risco residual explicitamente documentado; não registrar recuperação aprovada. Nenhuma migração/deploy está autorizada por este procedimento de preparação.

## Diagnóstico após instalação do cliente 17

pg_dump, pg_restore e psql foram encontrados no caminho /opt/homebrew/opt/libpq@17/bin. O preflight offline passou com a senha preenchida. A tentativa direta de psql e a reprodução do pg_dump retornaram autenticação recusada pelo servidor: `password authentication failed for user postgres`. Não houve erro observado de DNS/rede nem diagnóstico de permissão em schema; falhou antes da leitura dos dados. Não é possível validar grants pela conexão que não autenticou. sslmode=require foi usado; uma sessão TLS autenticada ainda não foi comprovada por consulta em pg_stat_ssl.

O valor parseado corresponde exatamente ao conteúdo literal entre aspas do campo da senha; não há espaços externos, quebras de linha ou caracteres de formatação invisíveis detectados. util.parseEnv não expande $ nem trata # entre aspas como comentário. Isso comprova leitura do arquivo, NÃO que a senha corresponde à credencial ativa do servidor. Host e usuário são os diretos conhecidos do principal. Não redefinir senha automaticamente nem continuar tentando o mesmo valor. Troca para Session Pooler não corrige por si só senha recusada: conferir a conexão correta no painel antes de considerar nova tentativa.

Executor corrigido: diagnóstico fechado e sanitizado, teste separado via psql antes do dump, exigência de versão/TLS/privilégios, PGOPTIONS read-only, arquivo com extensão .partial até concluir dump + índice + decodificação integral por pg_restore sem conexão. Só após essas verificações passa a .dump. Falhas recebem status completed=false/usableForRecovery=false. Um arquivo anterior com extensão .dump incompleto foi renomeado para .invalid-partial; registros de tentativas incompletas preservados e marcados inválidos, não apagados indiscriminadamente. Mesmo decodificação integral local não comprova recuperação num servidor.

Nenhum backup concluído foi produzido. O único passo humano necessário agora é conferir se a senha ORIGINAL preenchida é de fato a senha PostgreSQL ATIVA deste projeto e corrigi-la localmente se necessário (não enviar ao chat). Se a senha estiver comprovadamente correta, comparar no painel Connect o host e o usuário da conexão direta/Session pooler; a senha não deve ser redefinida para fins de diagnóstico sem decisão explícita. Depois rodar --check e --run. Nenhum erro bruto ou conexão foi salvo em relatório público.

Testes locais específicos confirmam classificação de erros sem propagação de segredos. A recuperação efetiva continua pendente de backup concluído e ensaio isolado autorizado, sem tocar em B ou no principal.

## Após a redefinição manual de senha

Novo diagnóstico autorizado: DNS direto resolve somente IPv6; TCP 5432 retornou ECONNREFUSED e psql confirmou Connection refused (exit 2). Não houve rejeição de senha nesta tentativa: o servidor não chegou à autenticação/TLS. Isso não permite afirmar que a nova senha já entrou em vigor, nem identificar se a causa na infraestrutura é reinício, listener ou outra indisponibilidade. Nenhuma senha foi redefinida pelo executor.

O diagnóstico local passou a distinguir porta recusada de timeout/senha inválida e recebeu teste de regressão. O próximo destino deve ser o Session Pooler oficial: obter SOMENTE o host de Connect → Session pooler do principal. Usar usuário postgres.wxmsqhmifqvtrlgosrjp, banco postgres, porta 5432, TLS, senha já preenchida separadamente. Não deduzir região/host nem usar transaction pooler 6543.

O navegador disponível está sem sessão Supabase. A leitura direta da credencial CLI foi bloqueada pela revisão automática de segurança; não contornar por outros meios de extração. Precisa-se do host oficial fornecido pelo responsável ou acesso oficial autenticado ao painel. Nenhum parâmetro de conexão ou senha foi alterado sem essa informação. O backup continua não concluído, com recuperação não comprovada.

### Entrega acadêmica imediata se o acesso ao banco não for resolvido

- Entregar a RC homologada e as evidências existentes: autenticação/CRUD/fotos/GPS/mapa e bônus LGPD real no descartável, explicitamente identificado.
- Manter o principal intacto e o bônus desabilitado; não alegar implantação definitiva.
- Professor instala o Development Build e executa npm ci/Metro com URL e Publishable Key do ambiente escolhido, fornecidas privadamente; nenhuma Admin Key no aplicativo.
- Para consulta no descartável, preservar B e fornecer acesso autorizado por canal privado, sem credenciais no GitHub/vídeo. Não excluir B para demonstração; mostrar evidências anteriores da exclusão real. Um teste destrutivo adicional exige outra conta dedicada e autorização.
- Usar os roteiros PROVA-III-CONCLUSAO-MOBILE.md e PROVA-III-RELEASE-CANDIDATE.md. Conferir acesso aos links e o enunciado antes de enviar até 27/11/2026. A publicação GitHub continua dependendo de autorização; nenhum push automático.

## Backup concluído pelo Session Pooler oficial

O responsável forneceu e autorizou host aws-0-us-east-2.pooler.supabase.com, porta 5432, banco postgres e usuário postgres.wxmsqhmifqvtrlgosrjp. Somente FALAAI_BACKUP_DATABASE_URL foi atualizada; senha preservada, .env.local principal intacto, modo 0600 e Git/Metro isolados.

Conexão autenticou: senha atual aceita, servidor 17.12, SELECT em auth.users/auth.identities. A primeira verificação encontrou pg_stat_ssl=false, que descreve o trecho INTERNO Pooler–PostgreSQL. Foi corrigido o preflight para comprovar o TLS cliente–Pooler via conninfo do psql (sslmode=require mantido, LC_ALL=C), sem exigir que o trecho interno seja apresentado como TLS pelo PostgreSQL. Nenhuma configuração remota de TLS foi alterada. Teste de regressão adicionado; 147 testes locais passaram, diff --check aprovado.

Backup concluído em `.artifacts/backups/2026-11-25T17-33-30-388Z/principal.dump`, 420204 bytes, modo 0600, pais 0700, ignorado e fora do bundle. pg_dump 17.12 retornou sucesso, pg_restore --list passou e pg_restore decodificou o arquivo inteiro sem conexão remota. Foi feita leitura local adicional dos dados COPY, sem divulgar linhas ou valores sensíveis:

- auth.users: 2; auth.identities: 2.
- public.profiles: 2; public.occurrences: 1.
- public.occurrence_photo_files: 0; storage.objects: 0.
- 43 entradas TABLE DATA; presença de funções, triggers, políticas, ACLs e FKs confirmada.

Evidência privada em content-validation.json e índice/status na mesma pasta. Nada foi excluído/removido no servidor. Arquivos .partial/.invalid-partial de falhas anteriores continuam inválidos e não são o backup concluído. Não divulgar dump, índice ou dados Auth; fazer cópia protegida fora da worktree.

### Procedimento mínimo para comprovar recuperação — ainda NÃO executado

1. Autorizar um destino Supabase PostgreSQL 17 vazio, separado do principal e do descartável que contém B; verificar disponibilidade de vaga gratuita, sem excluir projetos nem contratar automaticamente.
2. Com o índice privado, preparar restauração compatível com schemas/extensões e roles gerenciadas já existentes no destino, seguindo o guia oficial de backup/restore Supabase. Não executar pg_restore --clean indiscriminadamente contra qualquer projeto. O dump custom é completo de um banco, mas não inclui roles globais ou configuração externa do provedor; não é garantia de recriar serviço gerenciado do zero sem esse planejamento.
3. Restaurar apenas no destino autorizado; interromper diante de qualquer erro. Conferir UUIDs/identities, perfis/autor da ocorrência, FKs, funções/triggers/políticas/privilégios e ausência de grants extras. Verificar login de conta existente usando credencial conhecida, sem redefinição automática nem coleta no chat.
4. Comparar dados, não apenas contagens; validar que RLS continua impedindo acesso indevido. Storage estava sem objetos, portanto não há bytes de fotos a recuperar neste snapshot. Não tocar em B para esse teste.

Se não houver destino gratuito disponível, a legibilidade/decodificação e conteúdo do backup estão comprovados, mas restauração efetiva segue pendente. Uma base PostgreSQL 17 local temporária exigiria servidor/roles/extensões e não foi instalada. A decisão de aceitar o risco residual deve ser explícita antes da migração: esta rodada NÃO aplicou 003 nem fez deploy. Inventário e confirmação de senha anteriores passam a ser históricos: a conexão atual e o dump funcionaram pelo Pooler.
