# Preparação da migração inicial — somente ambiente descartável

Destino exclusivo: falaai-lgpd-validacao. Nenhuma execução remota nesta preparação.
Migração: supabase/migrations/20261121000100_initial_profiles_occurrences.sql.
Não foi modificada; já usada anteriormente no projeto principal.

## Pré-condições e evidência

O aluno informou inventário A-J compatível com projeto novo e delete-account ausente
no painel. A inspeção anterior por API retornou zero usuários, zero buckets e sem
estruturas FalaAí expostas. Não executamos novamente SQL nem confirmamos os resultados
manuais diretamente nesta rodada.

Antes da migração, ainda conferir no bloco A do novo script readonly: auth.users,
auth.uid(), gen_random_uuid() nativo e as quatro roles esperadas existem. O inventário
anterior não verificou explicitamente todos esses itens. Usar SQL Editor com papel
administrativo padrão postgres do projeto descartável; não tentar executar DDL pelo
aplicativo ou pela publishable key. Se houver erro de permissão, parar, não conceder
permissões globais nem alterar roles.

Não pode existir public.profiles/public.occurrences, funções/triggers FalaAí ou
políticas anteriores conflitantes. Se o estado mudou desde o inventário, repetir
somente os SELECTs antes. Não reexecutar a migração se houver indício de aplicação.

## Revisão de impacto

- Cria profiles e occurrences; habilita RLS e cria seis políticas.
- profiles: SELECT próprio e UPDATE apenas display_name. Sem INSERT/DELETE pelo app.
- occurrences: leitura comunitária para autenticado com perfil; criação própria;
  edição/exclusão próprias. INSERT/UPDATE apenas em colunas permitidas; author_id,
  UUID, status e datas não são escolhidos pelo aplicativo.
- anon/PUBLIC não recebem acesso às tabelas. service_role/owner podem contornar RLS:
  nunca usar chave administrativa no cliente. RLS não é FORCE neste desenho.
- auth.users não tem suas contas, senhas ou configuração de e-mail alteradas.
  É instalado um AFTER INSERT que cria perfil no mesmo cadastro. Se ele falhar,
  novos cadastros podem falhar; isso precisa ser testado com conta descartável
  somente em outra etapa autorizada. Não há novo cadastro nesta preparação.
- SECURITY DEFINER em create_profile, com search_path vazio e tabelas qualificadas;
  sem EXECUTE para anon/authenticated. touch_occurrence atualiza updated_at via
  trigger BEFORE UPDATE, também com search_path vazio.
- O backfill insere profiles de usuários Auth existentes; não cria identidades nem
  altera perfis preexistentes por conflito. Com zero usuários, não insere linhas.
- Duas FKs apontam a auth.users com ON DELETE CASCADE. Após Storage, a FK RESTRICT
  do registro de fotos exigirá limpeza antes de exclusão Auth. Não excluir contas.
- photo_path é uma coluna preparada, não integração Storage completa. Sem bucket,
  policies/fila de arquivos ou LGPD nesta migração. Não usar fotos nesse ambiente
  antes da migração 002. Esta etapa não exige aceite nem registra consentimento.

## Procedimento exato — somente após aprovação

1. Abrir Dashboard e selecionar falaai-lgpd-validacao. Conferir nome e Project Ref
   com a URL/Ref do arquivo local descartável. Não abrir o projeto principal.
2. SQL Editor → consulta nova/vazia. Executar SOMENTE o bloco A de
   supabase/tests/initial_migration_verify_readonly.sql. Todos true. Parar se não.
3. Abrir outra consulta vazia. No VS Code, copiar o arquivo COMPLETO
   20261121000100_initial_profiles_occurrences.sql, de BEGIN até COMMIT, sem editar.
4. Conferir novamente o projeto e o conteúdo: somente migração 001; sem 002/003,
   scripts de teste ou credenciais. O arquivo contém escrita/DDL intencionalmente;
   sua execução exige aprovação específica, diferente do inventário de leitura.
5. Clicar Run uma única vez. Não executar por fragmentos. A resposta esperada é
   sucesso sem linhas retornadas. Guardar o resultado antes de prosseguir.
6. Se aparecer erro, parar e retornar mensagem + etapa. BEGIN/COMMIT pretendem
   atomicidade. Não presumir rollback sem conferir catálogo; não repetir Run, não
   apagar tabelas ou aplicar DROP/RESET. Se sessão ficar em transação abortada,
   interromper e pedir orientação antes de qualquer comando adicional.
7. Em consulta vazia, executar um bloco B-I por vez do script readonly e registrar
   resultados. Bloco C tem três SELECTs: executar separadamente para capturar cada
   grade. Não confundir essa consulta readonly com a aba que contém a migração.
8. Retornar resultados antes de criar bucket, aplicar 002/003 ou testar cadastro.

## Conferência após aplicação (somente SELECT)

| Bloco | Resultado necessário |
| --- | --- |
| A | Quatro booleanos true (dependências) |
| B | Duas tabelas existentes, RLS true |
| C | profiles com 3 colunas; occurrences com 11; duas PKs e duas FKs CASCADE; constraints da migração; quatro índices totais incluindo PKs |
| D | 6 políticas para authenticated: profiles_select_own, profiles_update_own, occurrences_select_community, occurrences_insert_own, occurrences_update_own, occurrences_delete_own |
| E | anon tudo false; authenticated SELECT nas duas e DELETE só em occurrences; INSERT/UPDATE de tabela false porque grants são por coluna |
| F | Todas as 28 linhas table_exists/column_exists/privileges_match=true; colunas protegidas sem escrita |
| G | Duas funções; definer true só em create_profile; search_path vazio; EXECUTE anon/authenticated false |
| H | Dois triggers ativos e nas tabelas/eventos corretos |
| I | Quatro contagens zero, se nenhum usuário foi criado desde a inspeção |

Se surgirem dados, não apagar: conferir se houve criação manual/concorrente.
Qualquer objeto ausente, RLS false, política/grant diferente ou execução pública
inesperada impede avançar. Comparar expressões das políticas, não somente os nomes.

O script de verificação não dispara triggers, não executa auth.uid() nem funções
FalaAí. Usa built-ins de metadados e consulta apenas contagens de dados. Verificar
catálogo não demonstra comportamento: testes de cadastro, autorização A/B e CRUD
real ainda dependem de etapa explicitamente autorizada.

## Erros possíveis / parada

- relation/function/policy/trigger already exists: conflito ou aplicação anterior;
  revisar inventário, nunca substituir estruturas para forçar sucesso.
- permission denied / must be owner: papel do Editor inadequado ou restrições do
  serviço; não alterar privilégios nem configurar service_role no aplicativo.
- ausência de auth.users/auth.uid/gen_random_uuid/roles: ambiente incompatível.
- SQL parcialmente copiado, sintaxe ou transação abortada: retornar erro, sem Run
  repetido. Corrigir o procedimento após revisar estado, sem tocar no principal.
- falha posterior no cadastro: investigar trigger/profile; não desabilitar RLS ou
  contornar Auth. Não criar conta agora apenas para experimentar.

## Modelo para retornar

```text
Projeto confirmado: falaai-lgpd-validacao
Pré-condições A: todos true / divergência
Aplicação 001: sucesso / erro (mensagem sem segredos)
B: duas tabelas existentes com RLS true / divergência
C: colunas, constraints e índices (grades ou divergências)
D: seis políticas (grade)
E: grants de tabela (grade)
F: 28 linhas, todos privileges_match=true / divergência
G: funções e permissões (grade)
H: dois triggers ativos (grade)
I: auth_users=..., profiles=..., occurrences=..., auth_without_profile=...
Nenhum bucket/usuário/foto criado; nenhuma outra migração aplicada.
```

Esta preparação não executa nada no remoto e não autoriza automaticamente a etapa
seguinte. Projeto principal, .env.local e flags destrutivas permanecem inalterados.
