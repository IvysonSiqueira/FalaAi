# Backup proporcional e autorização final

## Clientes: impedimento resolvido

O responsável confirmou ser o único usuário atual, sem distribuição pública ou a terceiros; o Samsung S23 Ultra utiliza exclusivamente a RC homologada 2adbe1f, incluindo metadata de aceite. Essa declaração é a confirmação humana necessária. Não é necessário desenvolver telemetria ou controle de versões. O segundo usuário Auth não implica um segundo cliente ativo; não inventar aceite para nenhuma conta antiga.

## Resultado desta preparação

Homebrew está disponível. pg_dump/pg_restore/psql não foram encontrados no PATH nem nas instalações usuais Homebrew/Postgres.app. A configuração local não contém conexão/senha PostgreSQL. A Supabase CLI autenticada permite o inventário, mas API keys não são senha do banco. Não executar dump CLI que possa provisionar credencial temporária, pois a rodada proíbe alterações remotas.

Alternativa leve recomendada: instalar SOMENTE clientes PostgreSQL `libpq`, sem servidor local, Docker ou plano pago. Não foi feita instalação nesta rodada. Backup lógico custom via pg_dump pode conter schema, dados Auth (incluindo hashes sensíveis), identities/sessões e dependências, tabelas de aplicação, funções, triggers, índices, RLS e ACLs. Não usar --schema public, --data-only, --no-acl ou --no-owner como substituto de cópia completa. pg_dump não exporta roles globais, configurações externas do Auth, chaves, funções Edge ou bytes do Storage. Registrar separadamente as configurações e eventuais roles customizadas; roles gerenciadas devem existir no destino Supabase. Não recriar às cegas roles gerenciadas.

Foi preparado `scripts/backup-main-postgres.cjs`. Seu --check foi executado e bloqueou corretamente por ausência do arquivo de conexão. Nenhum dump foi gerado; NÃO há evidência de restauração real nesta rodada. Inventário anterior não é backup recuperável. A verificação de índice com pg_restore --list prevista no script comprova legibilidade, não restauração.

## Preparação local mínima

1. Se aceitar a instalação leve de clientes, executar `brew install libpq`. Isso não cria servidor PostgreSQL, mas pode baixar dependências de cliente, como TLS; conferir a proposta do Homebrew antes de confirmar.
2. No painel do principal, botão Connect, obter conexão PostgreSQL direta ou Session pooler, porta 5432, banco postgres. Necessária senha do BANCO, não Publishable/Secret key. Não redefinir senha existente sem avaliar os consumidores. Não enviar a conexão pelo chat.
3. Criar `.env.main-backup.local` na raiz, com permissão 0600, contendo os campos abaixo. Usar aspas e URL-encode na senha da URI; #/$ literais não devem virar comentários ou expansão shell. O leitor usa util.parseEnv, sem expansão. Não executar `source`.

```dotenv
FALAAI_BACKUP_PROJECT_REF=wxmsqhmifqvtrlgosrjp
FALAAI_BACKUP_PG_BIN=/opt/homebrew/opt/libpq/bin
# Copiar a conexão real pelo painel, não usar o exemplo como credencial:
# FALAAI_BACKUP_DATABASE_URL="postgresql://.../postgres?sslmode=require"
```

4. Conferir `git check-ignore .env.main-backup.local`; executar `node scripts/backup-main-postgres.cjs --check`. O script fixa o Ref principal, host/usuário direto ou Session pooler, TLS e porta 5432, e nunca imprime a conexão.
5. Com o aplicativo parado para evitar novas escritas durante a coleta, executar `node scripts/backup-main-postgres.cjs --run`. É leitura remota: não chama migrações, Admin Auth ou deploy; pg_dump usa snapshot consistente. Arquivo custom e índice ficam em .artifacts/backups/<data>, diretório 0700, arquivos 0600, ignorados e bloqueados no Metro. Falha/version mismatch gera bloqueio, sem imprimir stderr sensível. Dump parcial não pode ser usado.
6. Confirmar no índice as tabelas Auth e public, dados, funções, constraints, ACLs e políticas; conferir também objetos gerenciados relevantes. Guardar uma cópia protegida fora da worktree. Não publicar arquivo nem índice. O script não criptografa: permissões são controle local, não proteção contra acesso à conta do Mac; usar armazenamento criptografado para cópia externa.

## Recuperação efetiva — teste ainda necessário

A restauração requer destino PostgreSQL/Supabase separado, compatível, sem B nem dados a preservar. NÃO usar o descartável atual (contém B) nem o principal para ensaios. Não foi autorizado criar/modificar esse destino nesta rodada. Também não se deve contratar plano ou remover projeto para liberar vaga automaticamente.

No destino limpo autorizado, mapear roles/owners gerenciados, schema Auth/Storage preexistentes e extensões antes de definir o plano de restauração. Um pg_restore integral às cegas em Supabase novo pode conflitar com objetos gerenciados. Seguir o procedimento oficial de backup/restore do Supabase com arquivos de esquema/dados/roles compatíveis, ou plano específico revisado a partir do índice do arquivo custom. Não usar --clean/--disable-triggers indiscriminadamente nem afirmar que basta inserir users pela Admin API: isso perde IDs/senhas/dependências.

Evidências mínimas após restauração autorizada: dois UUIDs/Auth/identities preservados, login real de usuário antigo, dois perfis, ocorrência vinculada ao mesmo autor, FKs/índices/RLS/grants/funções e triggers correspondentes, cadastro criando perfil corretamente. Recontar Storage imediatamente antes da captura: inventário anterior tinha zero arquivos; se houver novos objetos, copiar bytes e metadados separadamente. Nenhum comando de restauração é executado pelo preparador.

Sem ambiente de restauração disponível, a cópia pode ser preparada e inspecionada, mas o risco residual de recuperação deve ser explicitamente reconhecido pelo responsável; não registrar como teste aprovado. Nesta execução nem a cópia foi possível sem cliente e conexão. Não ampliar para infraestrutura comercial apenas para a apresentação.

Fontes oficiais: https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore e https://supabase.com/docs/guides/platform/backups .

## Outros impedimentos técnicos

A inspeção anterior confirmou compatibilidade estrutural de 001/002: nove corpos de função iguais, 15 políticas esperadas, quatro triggers habilitados, índices/restrições, ACLs e bucket corretos. Não há defeito conhecido adicional que impeça a 003. Isso não equivale a autorização de aplicá-la sem cópia/recuperação. Cadastro público com confirmação de e-mail ainda requer caixa real e envio efetivo, não confirmação Admin.

A exclusão na UI está fixada à allowlist do descartável. A 003 e a Edge desabilitada no principal não exigem habilitar UI; disponibilização real no principal exige futura alteração/revisão explícita da allowlist. Nenhuma exclusão é necessária para validar esta implantação inicial desabilitada.

## Sequência consolidada para autorização posterior

1. Confirmar checkpoint RC, único cliente homologado (já declarado), cópia e limitações de recuperação aceitas/validadas. Parar novas escritas do app e recontar principal imediatamente antes.
2. Salvar contagens/UUIDs existentes e definições que a 003 substitui; conferir ausência de objetos LGPD. Não reaplicar 001/002. Registrar que usuários existentes não têm consentimento formal.
3. Executar 003 inteira (BEGIN/COMMIT) uma única vez, Ref principal explícito. Em erro, parar, inspecionar rollback e não executar trechos avulsos.
4. Usar verificador consolidado adaptado ao principal populado: substituir apenas expectativas de destino/contagens iniciais, preservar todos os testes de corpo, privilégios/RLS, triggers/constraints/bucket. Conferir que os dois usuários antigos não receberam aceite retroativo e os dados anteriores continuam iguais.
5. Definir ACCOUNT_DELETION_ENABLED=false e implantar delete-account com Ref principal explícito via CLI autenticada. Não usar executor descartável que bloqueia o principal. Verificar variáveis no runtime sem expor valores e GET 503 disabled.
6. Samsung: login existente/restauração; cadastro público novo com aceite e caixa real, confirmação por link; CRUD/foto/GPS com relato dedicado; Perfil/aviso/cancelamento e serviço disabled. Não excluir contas existentes. Testes RLS adicionais usam apenas fixtures previamente autorizadas.
7. Se qualquer teste falhar, manter exclusão false, interromper liberação e preservar trabalhos/dados. Não executar rollback destrutivo; analisar correção ou recuperação com a cópia.

## Alternativa acadêmica sem implantação principal

Entregar RC homologada, README, código/migrações/Edge e evidências: requisitos obrigatórios já validados no principal; bônus validado no descartável, expressamente identificado. Não alegar que o bônus está implantado no principal.

Execução pelo professor: Development Build existente instalado; npm ci; Metro com configuração pública do projeto escolhido em arquivo local ignorado, conforme .env.example. Para principal, usar .env.local próprio com URL e Publishable Key, sem chave administrativa; exclusão permanece indisponível. Para demonstrar bônus no descartável, compartilhar somente URL/Publishable Key e credencial de CONTA dedicada por canal privado, nunca Admin Key, arquivo de fixtures ou senha de B versionados. Não entregar .env.lgpd-validacao.local: ele contém Admin Key. O lançador atual de manutenção lê esse arquivo, portanto NÃO deve ser requisito do professor. Preferir Metro normal com EXPO_NO_DOTENV=1 e apenas EXPO_PUBLIC_* fornecidas ao processo local, mantendo flags de exclusão false até autorização específica. Não substituir permanentemente a configuração principal do aluno.

B deve continuar preservada; usar evidências existentes de exclusão ou nova conta dedicada autorizada para outra demonstração. Gravação/relatório podem provar o bônus sem deixar exclusão ativa. Não divulgar credenciais no GitHub, vídeo ou relatório público. O aviso/aceite do cadastro pode ser demonstrado, mas envio/confirmação de e-mail só recebe status aprovado após teste real.

## Atualização da conexão preparada

libpq 19 instalado pelo responsável; principal confirmado em PostgreSQL 17.12. Configuração protegida criada com senha separada e caminho para libpq@17, pacote cliente compatível disponível, ainda não instalado. A conexão direta IPv6 respondeu na porta 5432. Seguir PROVA-III-CONEXAO-BACKUP.md em vez do exemplo anterior de senha na URI. O executor agora exige família 17 para evitar confiar em restauração descendente 19→17.
