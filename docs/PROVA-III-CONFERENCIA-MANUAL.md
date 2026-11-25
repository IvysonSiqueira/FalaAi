# Conferência manual antes das migrações

Somente falaai-lgpd-validacao. Não autoriza migrações, deploy ou testes destrutivos.
Script: supabase/tests/disposable_inventory_readonly.sql, blocos A a J.

## Revisão local de segurança

O script contém dez SELECTs. Não contém DDL/DML, alteração de privilégios,
configurações ou transação, DO/CALL, RPC, SQL dinâmico ou execução de funções do
aplicativo. As funções chamadas foram revisadas e qualificadas com pg_catalog:

to_regclass, to_regprocedure, pg_get_function_identity_arguments,
pg_get_triggerdef, has_function_privilege e has_table_privilege.

Elas resolvem nomes ou consultam/formatam metadados e privilégios. to_regprocedure
não chama storage.allow_only_operation: só verifica se a assinatura existe.
pg_get_triggerdef devolve texto; não dispara trigger. Os SELECTs sobre pg_policies
não executam expressões das políticas. Palavras INSERT/DELETE/EXECUTE em literais
ou resultados são nomes de privilégios, não operações executadas.

Views information_schema e catálogos pg_catalog são fontes de metadados padrão.
Nenhuma função personalizada é usada para inspecionar o banco. A revisão pressupõe
um PostgreSQL/Supabase padrão, sem adulteração dos catálogos pelo administrador.
Consultas normais podem ser registradas em logs do provedor; não alteram objetos,
dados do aplicativo, ACLs ou configurações.

## Execução exata no painel

1. Abra o Dashboard e selecione falaai-lgpd-validacao. Confira o Project Ref na
   URL/página do projeto com o configurado localmente. Se estiver no principal, pare.
2. Abra SQL Editor e uma consulta nova/vazia; não use abas contendo migrações.
3. No VS Code, abra o arquivo do script. Copie somente o BLOCO A completo, desde o
   comentário até seu ponto e vírgula. Cole na consulta vazia do SQL Editor.
4. Confira que só colou o SELECT desse bloco. Clique Run. Não adicione SET ROLE,
   comandos sugeridos por IA, migrações ou helpers do aplicativo.
5. Registre o resultado ou captura apenas da grade. Substitua todo o texto do
   editor pelo próximo bloco e repita B a J. Não cole todos juntos: a interface
   pode mostrar somente o último conjunto de resultados.
6. Se aparecer erro, pare e envie o nome do bloco e mensagem sem segredos. Não
   tente consertar criando objetos, concedendo permissões ou desabilitando RLS.
7. Não execute as migrações depois: retorne os resultados para revisão.

Nenhuma chave ou senha é necessária no SQL: a sessão já autenticada do painel
executa as consultas. Não cole credenciais no editor, na conversa ou nas capturas.

## Resultados esperados e critérios de parada

| Bloco | Projeto novo | Quando parar |
| --- | --- | --- |
| A | 5 linhas; exists_in_catalog=false e rls_enabled=NULL | Qualquer tabela já existente |
| B | 0 linhas | Qualquer função FalaAí já presente |
| C | 0 linhas | Qualquer trigger FalaAí já presente |
| D | Nenhuma política própria do FalaAí | Política inesperada requer revisão; não apagar |
| E | Podem existir grants padrão de storage.objects; sem tabelas FalaAí | Grants/objetos inesperados requerem revisão; não conceder nada |
| F | 0 linhas | Grants sobre profiles/occurrences existentes |
| G | 0 linhas | Bucket já existente requer revisão; public=true impede seguir sem correção autorizada |
| H | 1 linha, todos os booleanos true | Qualquer false/NULL, erro ou ausência de linha |
| I | operation_helper_available=true | false ou erro bloqueiam a migração 002 |
| J | true ou false possíveis | true exige conferir histórico; não prova aplicação das migrações |

Políticas e grants padrão do serviço não são automaticamente vulnerabilidades.
Envie os resultados para distinguir configuração padrão de intervenção anterior.
NULL no RLS de uma tabela ausente no bloco A é normal; não equivale a RLS desativado
em tabela existente. O histórico CLI pode existir vazio; aplicação manual pode
não estar registrada nele. Não inferir situação das migrações apenas pelo bloco J.

## Edge Functions — somente painel

No MESMO projeto, abra Edge Functions. Procure o nome exato delete-account.
Se a lista estiver vazia ou o nome não estiver presente, informe “ausente”. Se
estiver presente, informe “presente” e, se visíveis, status e data do último deploy.
Não clicar Invoke/Test, Deploy, Create nem editar secrets. Erro de acesso ou lista
que não carrega significa “não verificado”, não ausência. Não invocar a função
para testar se existe. Presença no painel não prova que está habilitada ou segura.

## Modelo para retornar

```text
Projeto conferido no painel: falaai-lgpd-validacao
A: 5 linhas, todas false / ou resultado diferente
B: quantidade de linhas
C: quantidade de linhas
D: quantidade de linhas; enviar grade se houver
E: enviar grade de grants
F: quantidade de linhas
G: quantidade de linhas; enviar grade se houver
H: storage_objects_exists=..., storage_objects_rls=...,
   authenticated_select=..., authenticated_insert=..., authenticated_delete=...
I: operation_helper_available=...
J: cli_migration_history_exists=...
Edge Function delete-account: ausente / presente / não verificado
Erros: bloco e mensagem, se houver
```

Não enviar e-mails, senhas, tokens, chaves ou URLs assinadas. Resultados de catálogo
e privilégios deste script não precisam de dados pessoais para serem analisados.
