# Diagnóstico local do erro 42P01 — migração inicial

Não há execução remota neste diagnóstico. Migração original intocada e igual ao
checkpoint 46b9d6c. O erro informado pelo aluno é relation public.profiles does not
exist; sem LINE/POSITION/CONTEXT e sem o texto exato executado, causa e statement
responsável não podem ser determinados de forma conclusiva.

## Referências completas e ordem

Arquivo 20261121000100_initial_profiles_occurrences.sql, linhas verificadas localmente:

| Linha | Comando/referência |
| --- | --- |
| 6–10 | CREATE TABLE public.profiles, antes de todas as demais referências |
| 12 | ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY |
| 13 | REVOKE ALL ON public.profiles |
| 14–15 | GRANT SELECT e GRANT UPDATE(display_name) |
| 17–21 | Duas CREATE POLICY ON public.profiles |
| 28 | INSERT no corpo PL/pgSQL de falaai_create_profile |
| 39–41 | INSERT de backfill diretamente em public.profiles |
| 77 | SELECT public.profiles na política de leitura comunitária |
| 82 | SELECT public.profiles na política de inserção própria |

BEGIN está na linha 4 e COMMIT na 103. profiles precede suas permissões/políticas,
função e trigger Auth; backfill vem depois. occurrences é criada na 43; índices,
grants e RLS vêm depois; políticas comunitárias consultam profiles já criada.
updated_at ganha função/trigger ao final. Nenhuma referência antecipada foi achada.
Não há DROP, SET ROLE ou troca de schema/connection no arquivo.

As dependências externas são public/auth schemas, auth.users, auth.uid(), roles
anon/authenticated e gerador UUID; as roles padrão/privilegios administrativos do
SQL Editor precisam existir. Ausência de auth.users normalmente nomearia auth.users
no erro da FK, não public.profiles. Uma função ausente costuma produzir 42883;
transação já abortada costuma produzir 25P02. Essas hipóteses não provam o 42P01
informado como erro primário.

## O que pode emitir o erro

A linha 12 é o primeiro comando que exigiria a tabela já existente caso o CREATE
não fosse executado. REVOKE/GRANT/políticas e backfill também podem emitir 42P01 se
executados isoladamente sem profiles. Não é possível escolher um deles pelo código
de erro apenas.

A linha 28 é corpo de trigger, não um INSERT executado pela simples definição da
função. O script não insere em auth.users e portanto não dispara esse trigger por
si. Criar o trigger não é executar seu corpo. Caso CONTEXT cite a função durante
um cadastro, pode ser outra operação ou estrutura preexistente; não presumir isso.
As políticas nas linhas 77/82 precisam resolver profiles ao serem criadas, mas são
posteriores ao CREATE. search_path vazio nas funções não explica falha aqui:
public.profiles é sempre qualificada com schema.

Hipótese compatível, ainda não confirmada: trecho selecionado, cópia parcial ou
consulta diferente foi enviada pelo Editor sem o CREATE. Não atribuir a falha ao
usuário sem verificar o texto executado. Outra possibilidade, caso o erro aponte
o próprio CREATE, é handler de event trigger de DDL externo à migração; consultar
somente seus metadados e exigir CONTEXT antes de responsabilizá-lo.

## Transação e rollback

Se o arquivo completo foi executado na mesma sessão/transação, um erro deixa a
transação abortada: os objetos criados nela não podem ser confirmados normalmente.
Podem já ter sido revertidos no encerramento/limpeza da conexão ou ainda estar na
transação abortada. Não foi verificado como o painel encerrou essa execução.

Tabelas, funções e triggers ausentes num novo SELECT são compatíveis com rollback
integral, mas também com esses comandos nunca terem sido executados. Não provam
qual statement falhou. Presença parcial exige investigar execução por fragmentos
ou estruturas anteriores. Não anunciar rollback confirmado com base só no erro.

Se um novo SELECT retornar 25P02, pare e envie o erro; não adicionar comandos de
transação/correção nesta rodada. ROLLBACK seria uma ação separada, fora deste script
exclusivamente de leitura.

## Conferência manual somente de leitura

Arquivo supabase/tests/initial_migration_failure_readonly.sql, blocos A–G.
No SQL Editor do DESCARTÁVEL, em consulta vazia, executar um bloco por vez. Nenhuma
consulta acessa diretamente uma tabela FalaAí que possa estar ausente; são catálogos.
Nenhuma executa funções FalaAí, event triggers ou suas definições.

Esperado se rollback/ausência de aplicação:
- A: auth.users existe; profiles/occurrences não existem.
- B/C/D/E: zero linhas relativas aos objetos da 001.
- F: dependências true.
- G: podem existir event triggers de infraestrutura padrão; retornar só essa grade.

Se qualquer objeto da migração existir, não criar tabelas manualmente nem reexecutar
arquivo; enviar os resultados. Não executar DROP, IF NOT EXISTS, CREATE OR REPLACE
ou desabilitar triggers para ultrapassar o erro.

## Menor correção proposta e próxima execução condicionada

Não há defeito de ordenação demonstrado que justifique modificar a migração.
Portanto não geramos uma variante DDL especulativa, não alteramos o original e não
criamos profiles manualmente. A menor correção, SE confirmada execução parcial,
é corrigir o envio do arquivo integral ao Editor, preservando a transação original.

Antes de autorizar novamente:
1. Obter erro completo (LINE/POSITION/CONTEXT) e confirmar o texto realmente enviado,
   incluindo se havia seleção ativa. Não enviar credenciais junto às evidências.
2. Conferir A–G; revisar qualquer estrutura remanescente, dependência ou event trigger.
3. Se erro for externo ou parcialidade persistida, preparar correção separada para
   o descartável, baseada no diagnóstico, e submetê-la à aprovação. Não reutilizar
   CREATE TABLE sobre objetos existentes.
4. Só após nova autorização, abrir consulta vazia no descartável, colar arquivo
   integral BEGIN–COMMIT e garantir ausência de seleção parcial. Executar uma vez.
5. Conferir estrutura com initial_migration_verify_readonly.sql antes de qualquer
   bucket, próxima migração ou conta de teste.

Nesta rodada: nenhum arquivo de ambiente/flag/credencial alterado, nenhuma migração
reexecutada, nenhum banco modificado. Migração permanece NÃO CONFIRMADA como aplicada.

## Atualização: origem identificada do erro no bloco F

Os resultados relatados (A com quatro dependências, B com duas tabelas ausentes)
correspondem a initial_migration_verify_readonly.sql, não ao layout de
initial_migration_failure_readonly.sql. Existem dois blocos F com finalidades
diferentes; a identificação anterior não os tornou suficientemente distintos.

No arquivo failure, F consulta somente auth.uid(), gerador UUID e roles. Não havia
referência a profiles. No arquivo verify, F chamava:

    pg_catalog.has_column_privilege(roles.role_name::pg_catalog.name,
      expected.table_name, expected.column_name, 'INSERT')

e o equivalente UPDATE, também nas expressões privileges_match. Quando
expected.table_name = public.profiles e essa tabela não existe, esse overload
resolve a tabela pelo nome e pode emitir 42P01, apesar de estar dentro de SELECT.
Esse é um defeito de robustez do diagnóstico de pós-aplicação quando executado
antes da criação; o cabeçalho exigia sucesso da 001, mas o SELECT não se protegia.

Foi corrigido somente o diagnóstico: to_regclass e pg_attribute resolvem OID e
número da coluna de forma tolerante; CASE chama has_column_privilege por OID/attnum
somente se tabela/coluna existem. Ausência aparece explicitamente como false e
privilégios/resultado de comparação NULL, nunca como aprovação. O bloco I do verify
continua pós-aplicação e não deve ser executado com tabelas ausentes, pois faz
contagens diretas. Para falha de migração, usar exclusivamente o arquivo failure.

Os dois blocos G foram conferidos: failure lê pg_event_trigger/pg_proc/pg_namespace
sem chamar handlers; verify consulta funções em pg_proc e privilégios por OID.
Nenhum depende de profiles e ambos são somente leitura.

Para nova conferência manual, copiar somente F-DEPENDENCIAS EXTERNAS do arquivo
failure, ou o SQL completo apresentado na resposta; depois G desse MESMO arquivo.
Não executar a migração. A ausência das tabelas ainda não comprova se a migração
falhou, sofreu rollback ou nunca foi executada integralmente. O 42P01 identificado
no pós-diagnóstico não demonstra um defeito no DDL da migração original.

## Atualização: 42883 no verificador de privilégios

Origem: initial_migration_verify_readonly.sql, bloco F. As duas chamadas INSERT e
UPDATE convertiam pg_attribute.attnum para integer. Esse cast foi introduzido na
correção anterior do diagnóstico e é incorreto: o overload exige smallint ou nome
textual de coluna. O CASE não impede erro de resolução de assinatura, que ocorre
antes da avaliação da condição. Alteradas somente essas chamadas para ::smallint;
roles continuam name, relação oid e privilégio literal text. A função é built-in.

A migração original não contém has_column_privilege nem o cast incorreto. Não foi
modificada. O arquivo que deveria ser executado para criar estruturas é SOMENTE
supabase/migrations/20261121000100_initial_profiles_occurrences.sql, integralmente
BEGIN-COMMIT, quando autorizado. Todos os arquivos em supabase/tests são consultas
de diagnóstico/verificação e NÃO aplicam a migração. O erro no verificador não
demonstra que o arquivo de migração tenha sido efetivamente enviado ao servidor.

Próxima consulta manual, antes de migração ou verificador completo:
supabase/tests/initial_migration_state_and_signatures_readonly.sql. Retorna somente
existência das duas tabelas e da assinatura correta no catálogo. Se tabelas false,
não executar o bloco I do verificador (contagens diretas). Se uma tabela existir e
outra não, parar e revisar estado parcial. Se ambas existirem, não reaplicar CREATE
TABLE: conferir estrutura pelo verificador corrigido. Não criar tabelas isoladas.

Outras chamadas revisadas: has_table_privilege(name,oid,text),
has_table_privilege(name,text,text), has_function_privilege(name,oid,text),
to_regclass(text), to_regprocedure(text), pg_get_triggerdef(oid),
pg_get_constraintdef(oid), pg_get_function_identity_arguments(oid) são compatíveis
com a documentação PostgreSQL (os argumentos opcionais das funções de definição
podem ser omitidos). Não foi identificado outro erro de assinatura. Isso é revisão
estática/documental; nenhum runtime PostgreSQL foi executado nesta rodada.
