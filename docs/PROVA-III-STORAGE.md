# Prova III — fotografias no Supabase Storage

Branch `codex/prova-iii-supabase`, worktree `e8ce`. Integração local preparada em
21/11/2026. Nenhuma alteração remota, criação de bucket, upload real ou aplicação
SQL foi executada por esta rodada. Não houve commit, push, build ou nova dependência.

## Estado confirmado e pendência obrigatória A/B

O responsável validou no Samsung Galaxy S23 Ultra autenticação, sessão, logout e
CRUD real (criação, leitura, reinício, edição e exclusão). Esta validação é do CRUD
anterior à integração das imagens. Fotografias e novas políticas ainda precisam
ser configuradas e testadas no projeto real e no aparelho.

**RLS NÃO VALIDADO entre usuários.** A tentativa de cadastro do usuário B ocorreu
em **21/11/2026 às 12h41**, mas o Supabase limitou os envios de e-mail. A conta
aparece aguardando verificação. Não desabilitar confirmação nem usar service_role
para simular B. Após a configuração/teste das fotografias, é obrigatório retomar
os testes remotos de CRUD e Storage com A e B confirmados. Uma leitura/edição de A
sobre os próprios registros não comprova proteção contra B.

## O que foi implementado localmente

- Câmera/galeria e prévia existentes, com `allowsEditing: false` e proporção
  preservada. `base64: true` utiliza o ImagePicker já presente no binário.
- Base64 convertido em ArrayBuffer no JavaScript; sem Blob, FormData ou FileSystem.
  Validação de tamanho declarado/real e assinatura dos bytes: JPEG, PNG ou WebP,
  no máximo 5 MiB (5.242.880 bytes). HEIC, GIF, SVG e outros formatos são recusados.
  Não há corte, redimensionamento ou transformação de imagem no Storage.
- Bucket privado `occurrence-photos`. Caminho gerado no servidor:
  `<UUID do usuário>/<UUID aleatório>.<jpg|png|webp>`. Sem sobrescrita/upsert.
- O banco guarda somente `photo_path`; não grava URI local, Base64 nem URL assinada.
  Listas/detalhes recuperam o caminho. A tela resolve a URL autorizada ao exibir.
- URLs assinadas duram 600 segundos. O componente renova a cada nove minutos,
  ao voltar ao app e pelo botão Atualizar fotografia. Erro na imagem não apaga
  o relato nem inventa foto local. A URL existe só no estado do componente.
- Edição: sem seleção mantém a foto; nova seleção substitui; remoção explícita
  envia null somente ao salvar. Cancelar/descartar seleção não apaga a foto antiga.
- Estado de envio e trava de mutação existentes impedem duplo toque. Sucesso
  depende do ACK do upload, do registro do arquivo e do insert/update do relato.
- Aviso e botão Tentar limpeza de fotos nas telas que usam OccurrenceFeedback.
  A recuperação também roda antes da listagem e após mutações confirmadas.

URLs assinadas são credenciais temporárias de leitura: quem recebe uma pode usá-la
até expirar. RLS é conferido ao emitir/renovar; não prometer revogação instantânea
por logout. Nunca copiar URLs assinadas para logs, banco, README ou capturas públicas.
Bucket privado não equivale a impedir o compartilhamento de uma URL já emitida.

## Consistência e recuperação

Banco e Storage não têm transação distribuída. A migração adiciona
`public.occurrence_photo_files`, uma reserva/fila durável por arquivo:

1. `reserve_occurrence_photo` gera caminho e estado `pending` antes do upload.
2. O cliente envia ArrayBuffer pela API Storage. Após ACK, a RPC
   `confirm_occurrence_photo_upload` verifica metadata e marca `uploaded`.
3. Insert/update com `photo_path` só é aceito se a reserva for do autor, estiver
   `uploaded` e o objeto existir. O trigger marca `linked` na mesma transação.
4. Se o cadastro falhar, `abandon_occurrence_photo` põe arquivos não vinculados
   em `cleanup`. Se a resposta do banco se perdeu mas ele já vinculou a foto,
   `linked` impede rollback cego e protege a imagem do relato confirmado.
5. Na substituição, a foto antiga vira `cleanup` somente quando o novo vínculo
   é confirmado. No delete, o trigger registra `cleanup` na mesma transação da
   exclusão. Sem registro de recuperação, o delete com foto é cancelado.
6. A API Storage remove os objetos elegíveis. Depois, `finish_occurrence_photo_cleanup`
   verifica ausência em storage.objects e ausência de referência em occurrences
   antes de encerrar a reserva. `remove` retornando [] não é prova de limpeza.

Se não há ACK de upload, o arquivo pode ainda estar em trânsito: a reserva abandonada
aguarda 24 horas antes de ser elegível. Reservas `pending`/`uploaded` esquecidas por
encerramento do app também ficam elegíveis após 24 horas. Substituições/exclusões
de fotos confirmadas e uploads confirmados cujo cadastro falhou podem ser limpos
imediatamente. A RPC respeita `cleanup_after` e não encerra registros antecipadamente.

A fila é persistente, mas **não há worker ou Cron autônomo** nesta entrega. O dono
precisa voltar ao aplicativo conectado ou solicitar a limpeza. São processados
até 20 arquivos por rodada; repetir se restarem pendências. Se o usuário nunca
retornar, a pendência continua no servidor e pode consumir Storage. Antes de
uso público, preparar processamento servidor agendado, monitoramento e limites.
Não prometer coleta imediata de todo órfão nem execução exatamente uma vez.

A FK do registro de arquivos usa ON DELETE RESTRICT: um futuro fluxo LGPD deverá
limpar arquivos antes de apagar a conta. LGPD não está implementada nesta rodada.
Não apagar manualmente essa fila para contornar falhas de limpeza.

## Migração e RLS preparados

Arquivo novo: `supabase/migrations/20261121000200_occurrence_photos_storage.sql`.
A migração inicial já aplicada permanece intacta.

- Não executa DELETE/INSERT/UPDATE de metadata em storage.objects ou storage.buckets.
  Objetos são removidos exclusivamente pela API Storage.
- Exige bucket existente, privado, com limites exatos; RLS de storage.objects ativo;
  grants padrão SELECT/INSERT/DELETE para authenticated; helper
  `storage.allow_only_operation(text)` disponível. Não concede grants globais.
- Se há photo_path antigo não nulo, aborta para revisão/backfill. Não apaga caminhos
  existentes para forçar a aplicação, nem usa IF NOT EXISTS para ocultar colisões.
- Reserva/fila: SELECT somente do próprio dono; escritas somente pelas RPCs/trigger.
  Funções security definer têm search_path vazio, objetos qualificados e validação
  explícita de auth.uid(). EXECUTE público/anônimo é revogado.
- Upload: só reserva `pending` do UUID autenticado na própria pasta.
- Leitura: só quando existe ocorrência correspondente visível sob a RLS atual.
  Não amplia visibilidade de profiles nem de occurrences.
- Delete: só dono de reserva `cleanup` elegível e sem referência ativa. SELECT de
  metadata necessário a delete é limitado às operações delete/delete_many pelo
  helper; isso NÃO autoriza download/listagem de órfãos.
- UPDATE in-place de objetos deste bucket é negado, inclusive para o dono. Trocar
  fotografia significa criar caminho novo e alterar o vínculo do próprio relato.
- Guardas RESTRICTIVE evitam que políticas permissivas antigas/alheias abram esse
  bucket. Outros buckets mantêm suas políticas; não removemos políticas existentes.
- Bucket anônimo bloqueado. Uma foto vinculada a um relato comunitário autorizado
  pode ser lida por B autenticado; B não pode alterar/remover o arquivo de A.

O helper por operação depende do Storage hospedado atual. Se a pré-condição falhar
ou a API não sinalizar a operação esperada, PARAR e revisar a compatibilidade;
não substituir por SELECT irrestrito do dono para fazer a limpeza funcionar.
Os checks do cliente/bucket não são antivírus ou validação completa de decodificação
no servidor. Conteúdo hostil de usuários não confiáveis pede hardening adicional
antes da implantação pública.

## Procedimento exato no painel — somente após confirmar destino

1. Confirmar no Dashboard o projeto **falaai-prova3** e comparar o project ref com
   o host da Project URL do `.env.local`, sem compartilhar valores por chat. Não
   selecionar projeto da Prova II/outro projeto, nem usar chave administrativa no app.
2. Executar primeiro o roteiro **somente leitura**
   `supabase/tests/storage_preflight.sql`. Conferir policies existentes, grants,
   RLS ativo, helper por operação e contagem de photo_path não nulo. Antes da nova
   migração, registry/RPCs ainda não existirão; isso é esperado.
3. Em Storage → New bucket, criar **occurrence-photos**, com **Public bucket OFF**.
   Configurar limite de upload **5 MiB / 5.242.880 bytes** e tipos MIME exatamente
   `image/jpeg`, `image/png`, `image/webp`. Se já existir, revisar identidade,
   conteúdo e configuração; não substituir nem esvaziar automaticamente.
4. No SQL Editor desse mesmo projeto, abrir uma consulta nova e executar somente
   o conteúdo completo de `20261121000200_occurrence_photos_storage.sql`.
   Não reaplicar `20261121000100_initial_profiles_occurrences.sql`. A transação
   deve confirmar; erro deve ser revisado, sem apagar dados/políticas para passar.
5. Reexecutar `storage_preflight.sql`: conferir bucket privado/limite/tipos, guardas
   e políticas `falaai_photos_*`, tabela occurrence_photo_files e sete funções
   (cinco RPCs + dois triggers). Conferir funções e RLS antes do teste no aparelho.
6. Como SQL Editor não necessariamente registra versão na tabela de migrações CLI,
   registrar a aplicação e reconciliar o histórico antes de futuro `supabase db push`.
7. Só então testar o JavaScript atual no Development Build já instalado. Até aplicar
   a configuração, upload falha explicitamente e pode aparecer aviso de migração
   na recuperação. Não há bucket fictício, fallback público ou upload simulado.

Nada desse procedimento foi executado remotamente pelo agente. Não há PostgreSQL
ou Docker local disponível para executar a migração em sandbox; a sintaxe/políticas
foram revisadas, mas isso não equivale a SQL/RLS executado no Supabase.

## Teste no Samsung Galaxy S23 Ultra

1. Reutilizar o Development Build com AsyncStorage e o Metro já existente na e8ce.
   Não há nova dependência nativa nem necessidade de outro APK. Se não houver
   Metro ativo, iniciar `npx expo start --dev-client` na raiz da worktree.
2. Entrar como A. Criar ocorrência com JPEG/PNG/WebP <=5 MiB, capturada ou da galeria.
   Conferir prévia inteira e trava de envio. Sucesso só após upload e banco.
3. No painel, conferir photo_path como caminho (sem URL/token), arquivo no bucket
   sob UUID de A e registry em linked. Não divulgar imagens/caminhos/tokens pessoais.
4. Fechar totalmente e reabrir; consultar detalhes e conferir a imagem. Testar
   orientação vertical/horizontal e fonte grande, sem recorte obrigatório.
5. Editar só texto: foto deve continuar. Selecionar nova foto, descartar e voltar:
   antiga deve continuar. Substituir e salvar: nova aparece; antiga deve sair do
   bucket após limpeza. Remover explicitamente e salvar: photo_path vira null.
6. Excluir uma ocorrência com foto. Conferir ausência da linha e do arquivo no
   Storage. Se aparecer pendência, reconectar e usar Tentar limpeza de fotos.
   Registry só deve sumir depois da remoção pela API e conferência remota.
7. Testar arquivo >5 MiB ou formato não aceito: mensagem e nenhum sucesso falso.
   Desligar rede durante envio/gravação; reconectar e atualizar antes de repetir.
   Se houver reserva sem ACK, conferir cleanup_after/janela de 24 horas, sem editar
   datas ou apagar metadata para fingir recuperação imediata.
8. Simular falha de limpeza em ambiente de teste: depois de remover/substituir,
   verificar que o caminho permanece em cleanup e que o retry conclui. Não apagar
   políticas do projeto validado para simular falha; testes locais já injetam erros.
9. Deixar os detalhes abertos por mais de dez minutos, alternar segundo plano e
   reconectar. Acesso deve renovar; erro deve oferecer atualização sem perder o relato.
10. **Retomar obrigatoriamente B após confirmação:** B pode ler relato comunitário
    de A e gerar acesso à foto vinculada; não pode editar/excluir relato de A,
    enviar para a pasta de A, sobrescrever ou remover foto de A. Anônimo não pode
    baixar. Arquivo desvinculado não pode gerar nova URL de leitura, nem para A.
    Uma URL já assinada pode durar até seu TTL; isso não é URL pública permanente.

## Testes remotos preparados (não aprovados)

`tests/storage.integration.cjs` testa upload, leitura por nova instância,
URL assinada, ausência de acesso público/anônimo, substituição e limpeza, delete,
B sobrescrevendo/removendo foto de A e CRUD indevido. Usa uma imagem sintética
mínima, sem GPS inventado, e tenta limpar suas próprias fixtures. Pode acionar
limpezas já pendentes das contas de teste: usar contas de desenvolvimento dedicadas.

Exige contas A/B já confirmadas e estas variáveis SOMENTE no processo Node:
`FALAAI_TEST_A_EMAIL`, `FALAAI_TEST_A_PASSWORD`, `FALAAI_TEST_B_EMAIL`,
`FALAAI_TEST_B_PASSWORD`, `FALAAI_TEST_PROJECT_REF` (ref confirmado).
Também exige `FALAAI_STORAGE_TEST_APPROVED=yes`. Nunca usar EXPO_PUBLIC para senhas.
O roteiro CRUD possui exemplo `read -rs` no zsh para entrada oculta. Não escrever
senhas em argumentos, histórico, arquivos versionados, prints ou logs.

```bash
node --test tests/occurrences.integration.cjs tests/storage.integration.cjs
```

Sem configuração, os testes declaram SKIP. Não interpretar isso como aprovação.
Executar somente após autorização do destino e confirmação de B; ao terminar,
remover do ambiente as variáveis de teste e conferir limpeza das fixtures no painel.

## Verificação local e arquivos

```bash
./node_modules/.bin/tsc --noEmit --incremental false
node --test tests/*.test.cjs
git diff --check
```

Novos serviços: occurrence-photos (bytes/Storage/RPC) e occurrence-media
(compensação e recuperação). Occurrences seleciona/persiste photo_path; AppContext
conecta os serviços e avisos; StoredReportPhoto resolve acesso temporário.
Formulário, Detalhes, Perfil, Login e componentes de foto/feedback foram ajustados.
Modelos, migração, roteiro preflight e testes foram versionados localmente.
MapLibre, GPS, navegação, autenticação, Expo/EAS e dependências nativas preservados.

Referências oficiais:
[Upload](https://supabase.com/docs/reference/javascript/storage-from-upload),
[URLs assinadas](https://supabase.com/docs/guides/storage/serving/downloads),
[excluir pela API Storage](https://supabase.com/docs/guides/storage/management/delete-objects),
[helpers por operação](https://supabase.com/docs/guides/storage/schema/helper-functions).

## Resultado desta rodada local

- TypeScript estrito sem emissão: aprovado.
- Testes locais: **68 aprovados** (46 da etapa CRUD e 22 novos/estendidos de fotos).
- Integrações remotas CRUD/Storage: **2 SKIP**, sem usuários A/B disponíveis e sem
  aprovação de destino/fixtures. Não representam aprovação de RLS.
- Bundles Android e web: HTTP 200 pelo Metro existente, sem iniciar outro servidor.
- `git diff --check`: aprovado. Nova migração e testes não estão ignorados;
  `.env.local` continua ignorado. Varredura básica não encontrou chave privada real.
- Sem nova dependência, APK, alteração de plugins/Expo/EAS ou execução SQL remota.
- A migração não foi executada em PostgreSQL local (psql/Docker indisponíveis).
- Pendente: confirmar destino, criar bucket privado, aplicar/revisar SQL, validar
  fotos no Samsung e retomar obrigatoriamente A/B após verificar o usuário B.
