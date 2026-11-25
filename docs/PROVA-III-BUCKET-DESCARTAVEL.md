# Preparação do bucket privado no descartável

Somente falaai-lgpd-validacao. Nenhuma ação remota executada nesta preparação.
O aluno confirmou a migração inicial estruturalmente e zero contas/perfis/relatos.
Essa confirmação é a evidência manual disponível; não repetimos SQL no servidor.

## Revisão da migração 002

20261121000200_occurrence_photos_storage.sql começa em BEGIN e termina em COMMIT.
O bloco inicial DO verifica bucket já existente; a migração NÃO cria o bucket.
Ela deve abortar se ele estiver ausente ou com parâmetros incompatíveis.
O cabeçalho histórico cita o principal; isso é comentário, não alvo técnico.
Este procedimento aplica-se exclusivamente ao descartável; original preservado.

Parâmetros obrigatórios:
- ID/nome: occurrence-photos, minúsculo e com hífen, sem espaços.
- public=false.
- file_size_limit=5242880 bytes, equivalentes a 5 MiB.
- allowed_mime_types: image/jpeg, image/png, image/webp, sem wildcard ou extras.

Dependências: 001 aplicada com public.profiles/public.occurrences, auth.users,
auth.uid(), UUID e roles padrão; schema Storage, objects com RLS e grants padrão
SELECT/INSERT/DELETE para authenticated; storage.allow_only_operation(text).
Nenhum photo_path não nulo anterior à integração. Registry, funções, triggers,
policies e índice únicos da 002 não podem já existir.

A migração prepara:
- occurrence_photo_files com estados pending/uploaded/linked/cleanup, RLS próprio,
  sem escrita direta pelo cliente; FK ao Auth com RESTRICT, sem exclusão cega.
- Cinco RPCs SECURITY DEFINER com search_path vazio, EXECUTE só para authenticated
  entre os papéis clientes; identidade vem de auth.uid().
- Reserva antes do upload; confirmação por metadata Storage; abandono e recuperação
  de reservas com janela de 24h para uploads incertos; limpeza em lotes de 20.
- Índice único de photo_path e dois triggers de vínculo/limpeza em occurrences.
- Oito policies em storage.objects: guards restritivas e permissões específicas.
  Anônimo não acessa o bucket; upload exige reserva própria pendente; download
  exige foto vinculada a relato visível por RLS; UPDATE/upsert do objeto negado;
  DELETE só de arquivo próprio em cleanup elegível e sem referência.
- SELECT adicional de metadata para operações delete/delete_many, pelo helper
  Storage, sem abrir download de reservas/órfãos.

Não altera grants globais de Storage, não remove policies anteriores e não apaga
arquivos por DELETE SQL. Substituição exige novo caminho; conservação da foto
antiga depende da confirmação do novo vínculo. Existência do helper não prova
semântica/end-to-end: políticas e recuperação ainda exigem testes reais.

## Criação manual proposta (somente quando aprovada)

1. Abrir Dashboard, selecionar falaai-lgpd-validacao e conferir Project Ref.
2. Storage → Buckets/Files → New bucket/Create bucket (nomes podem variar).
3. Informar occurrence-photos. Deixar Public bucket DESLIGADO.
4. Habilitar limite de tamanho por bucket. Se aceitar bytes, usar 5242880; se MiB,
   usar 5. Se mostrar apenas MB, não presumir equivalência: conferir o número real
   no bloco A após salvar. 5000000 não satisfaz a migração.
5. Habilitar restrição de MIME e inserir os três valores exatos, como opções
   separadas ou lista conforme o campo do painel. Não usar image/* ou extensões.
6. Se restrições estiverem apenas nas configurações após criação, abrir Settings
   do bucket e preencher antes de qualquer upload. Salvar uma única vez.
7. Não usar gerador de policies, não criar acesso público, não conceder permissões
   e não carregar fotografias nesta etapa. Se bucket já existir, parar e revisar,
   sem excluir/recriar ou substituir arquivos.
8. Conferir em Storage Settings que limite global não é menor que 5242880 bytes.
   Não alterar global automaticamente: se houver impedimento, retornar o problema.

Buckets e limites podem ser configurados pelo painel, conforme documentação:
https://supabase.com/docs/guides/storage/buckets/creating-buckets
https://supabase.com/docs/guides/storage/uploads/file-limits

## Validação manual depois de salvar (somente SELECT)

Arquivo supabase/tests/disposable_bucket_verify_readonly.sql. SQL Editor do mesmo
projeto, consulta vazia, um bloco A-F por vez. Não colar o arquivo de migração.

- A: bucket_exists/private_ok/size_ok/mime_ok true. id/nome esperado, public=false,
  file_size_limit=5242880 e array com três MIME. A ordem dos MIME não importa.
- B: todos os booleanos true. Se profiles/occurrences false, parar antes de C.
- C: legacy_photo_paths=0 e stored_objects=0. Se maior, preservar dados e revisar.
- D: registry_exists=false e photo_index_exists=false.
- E: zero funções da 002.
- F: normalmente zero policies Storage no projeto novo; qualquer linha deve ser
  revisada. Uma policy padrão não é automaticamente falha, mas não avançar sem
  compreender sua interação com guards/permissões novas.

Nenhuma consulta chama RPC de reserva/limpeza ou storage.allow_only_operation;
o script só consulta existência/metadata/contagens. Ele não depende de registro
occurrence_photo_files e não contém has_column_privilege.

## Critérios de interrupção antes da migração de fotografias

- Projeto/ref errado, bucket público, nome diferente ou campos NULL/incorretos.
- Limite real 5000000 ou outro valor; MIME genérico, ausente ou com formatos extras.
- Storage RLS/grants/helper ausentes. Não ampliar privilégios nem afrouxar SELECT.
- Estrutura 001 não confirmada, photo_path legado ou objetos já existentes.
- Registry, funções, triggers/policies ou índice da 002 já presentes: possível
  aplicação anterior/parcial. Não adicionar IF NOT EXISTS nem executar DROP.
- Qualquer erro SQL/permissão, dados inesperados ou painel que não salve limites.

O próximo passo será retornar A-F para revisão. Somente depois obter autorização
específica para aplicar o arquivo COMPLETO da 002, em transação. Criar o bucket
não equivale a aplicar RLS, upload funcional ou bônus LGPD validado. Nenhuma Edge
Function, conta, teste destrutivo ou migração LGPD deve ser executado nessa etapa.

Modelo de retorno:

```text
Projeto confirmado: falaai-lgpd-validacao
A: bucket_exists=..., private_ok=..., size_ok=..., mime_ok=...
   public=..., file_size_limit=..., allowed_mime_types=...
B: todos true / divergências
C: legacy_photo_paths=..., stored_objects=...
D: registry_exists=..., photo_index_exists=...
E: quantidade de linhas
F: quantidade de linhas; grade se houver
Limite global não impede 5 MiB: sim / não / não verificado
Erros: mensagem sem segredos
```
