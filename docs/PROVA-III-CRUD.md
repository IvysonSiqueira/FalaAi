# Prova III — CRUD real de ocorrências

> Atualização: o CRUD foi validado no Samsung pelo responsável. A etapa local de
> fotografias está em [PROVA-III-STORAGE.md](PROVA-III-STORAGE.md); referências
> abaixo a foto apenas como prévia descrevem a entrega anterior ao Storage.
> **RLS A/B ainda NÃO validado.** Em 21/11/2026 às 12h41, o Supabase limitou os
> envios no cadastro de B; conta aguardando verificação. Retomar obrigatoriamente
> os testes remotos de CRUD e Storage após a integração de fotografias.

Branch `codex/prova-iii-supabase`, worktree `e8ce`. Prazo: 24/11/2026 às 23h59.

## Entrega e limites de validação

Autenticação real validada pelo responsável no Samsung Galaxy S23 Ultra antes
desta rodada: cadastro, confirmação, login, persistência e logout. O novo build
contém AsyncStorage. Esta rodada não muda dependências, plugins ou configuração
nativa: usar o mesmo Development Build com JavaScript atualizado pelo Metro.
Não houve build, push, commit, nova migração ou alteração de RLS.

O CRUD está implementado e os testes locais usam API simulada. Não confundir esses
testes com comprovação do banco remoto. O teste de integração remoto preparado
requer duas contas confirmadas; foi marcado como não executado por falta dessas
credenciais no ambiente. Não acessamos tokens/sessões do celular, nem criamos
contas automaticamente. A validação completa no Samsung permanece pendente.

## Fluxo de dados

- `src/services/occurrences.ts`: PostgREST autenticado com o mesmo cliente Supabase.
  Create envia somente categoria/descrição/endereço/coordenadas. `author_id`
  recebe `auth.uid()` no banco; UUID, status e datas vêm dos defaults/triggers.
  Não se envia proprietário, ID, status, datas, URL ou URI de foto no payload.
- Read: páginas de 500 linhas com ordem por criação/UUID e deduplicação por UUID.
  Carrega todas as linhas autorizadas para manter indicadores completos no cenário
  acadêmico; não é paginação incremental de UI. Em grande volume será necessário
  separar consultas paginadas, contadores no servidor e limites geográficos do mapa.
  Leitura paginada não é um snapshot transacional entre modificações concorrentes.
- Update altera apenas categoria, descrição, endereço e GPS. Filtra UUID e UUID
  do usuário autenticado; `maybeSingle` sem linha é erro, nunca sucesso.
- Delete filtra UUID/proprietário e exige retorno de uma linha excluída. Sem linha
  afetada, informa ausência/permissão. A tela pede confirmação explícita.
- `src/services/occurrence-store.ts`: cache compartilhado com controle de consultas
  e mutações em andamento. Só incorpora respostas confirmadas. Respostas antigas
  não sobrescrevem mutações nem ressuscitam registros excluídos; dispose impede
  publicar resultados após logout/troca de conta. Não há optimistic update.
- AppContext mantém sua função de camada compartilhada. Limpa o cache na troca de
  identidade e busca novamente quando o perfil autenticado fica disponível.
- Home/Perfil filtram pelo UUID do usuário; Mapa mostra a comunidade autorizada e
  preserva filtros e marcadores com latitude/longitude do banco. Nomes de outros
  autores não ficam públicos: não mudamos a RLS de `profiles` para exibi-los.
- Telas atualizam ao ganhar foco, por botão ou pull-to-refresh nas listas. As
  mutações atualizam imediatamente o cache com a resposta confirmada. Não há
  Realtime; alterações de outro dispositivo aparecem após nova consulta.
- Detalhes e edição consultam o UUID no servidor; não dependem só da lista. A edição
  reutiliza Nova ocorrência com parâmetro opcional `reportId`, sem novo fluxo nativo.
- Há carregamento, erro distinto de vazio e tentativa novamente. Se existe cache,
  falha de leitura mantém os dados com aviso de possível desatualização. Sem dados,
  os indicadores ainda desconhecidos não são apresentados como zeros confirmados.

## Segurança

Mantidas as políticas da migração `20261121000100_initial_profiles_occurrences.sql`:
leitura comunitária autenticada com perfil; inserção própria; update/delete somente
do proprietário. Grants por coluna impedem enviar proprietário/ID/status/datas.
O cliente usa somente Publishable Key e a sessão. Esconder ações na UI e conferir
proprietário no cache são defesas adicionais; a autorização decisiva é a RLS.

Sem alteração de esquema ou aplicação de SQL remoto. Não executar novamente a
migração já aplicada. O roteiro `supabase/tests/initial_rls.sql` já inclui testes
A/B/anon em transação com rollback, para SQL Editor/banco de teste confirmado.
Não foi executado nesta rodada. Não usar service_role para simular permissões.

Não há fila offline nem garantia de execução exatamente uma vez. Se o servidor
confirmar uma gravação mas a resposta se perder, o formulário informa que não
conseguiu confirmar: atualizar a lista antes de repetir, evitando duplicidade.
O bloqueio de duplo toque não é uma chave de idempotência. Edições concorrentes
usam a última gravação; não há controle de versão/conflito nesta rodada.

## Fotos

Câmera, galeria, permissões e prévia completa preservadas. A foto fica somente no
estado do formulário. Os avisos deixam explícito que **não será anexada ao relato
salvo**. Não enviar `file://`, `content://` ou `photo_path` na criação/edição. Não
converter um caminho de Storage em URL sem resolver autorização. A edição de
campos textuais/GPS não apaga um `photo_path` eventualmente existente no banco,
mas esta versão não carrega nem mostra essas imagens como fotos remotas.

Próxima fase: definir bucket privado e políticas Storage por usuário; enviar os
bytes da foto com caminho `<auth.uid()>/<identificador>`; persistir o caminho após
upload confirmado; resolver URL assinada para leitura autorizada; tratar falhas,
substituição/exclusão e arquivos órfãos. Testar acesso entre usuários e não guardar
URLs assinadas expirantes como identidade da foto. Isso não foi implementado agora.

## Verificações

```bash
./node_modules/.bin/tsc --noEmit --incremental false
node --test tests/*.test.cjs
git diff --check
```

Testes locais cobrem payload permitido, validações, paginação, retorno do servidor,
erros, update/delete sem linha afetada, bloqueio de outro proprietário no cache,
sincronização, consultas fora de ordem, duplicação de envio e troca de sessão.
O teste de leitura por nova instância no banco real é separado abaixo.
Bundles Android/web são consultados no Metro já ativo; não é iniciado outro Expo.
Compilar não equivale a executar câmera/GPS/CRUD no celular.

### Integração remota opt-in

Arquivo: `tests/occurrences.integration.cjs`. Utiliza duas contas existentes e
confirmadas A/B no projeto de desenvolvimento identificado pelo `.env.local`.
Cria apenas suas fixtures e tenta limpá-las ao terminar. Não altera políticas nem
contas. Testa Create, leitura por nova instância, Update, Delete, leitura da
comunidade, acesso anônimo negado e update/delete direto por B (sem filtro de
proprietário da interface). Confere também que `author_id` não é gravável.

Para executar, fornecer `FALAAI_TEST_A_EMAIL`, `FALAAI_TEST_A_PASSWORD`,
`FALAAI_TEST_B_EMAIL` e `FALAAI_TEST_B_PASSWORD` apenas no ambiente do processo Node.
**Nunca usar EXPO_PUBLIC para senhas**, nem passá-las em argumentos de comandos,
logs, chat ou arquivos versionados. Exemplo de entrada interativa no zsh (senhas
não ecoam nem entram no histórico como argumentos):

```zsh
read -r "FALAAI_TEST_A_EMAIL?E-mail de teste A: "
read -rs "FALAAI_TEST_A_PASSWORD?Senha de teste A (oculta): "
printf '\n'
read -r "FALAAI_TEST_B_EMAIL?E-mail de teste B: "
read -rs "FALAAI_TEST_B_PASSWORD?Senha de teste B (oculta): "
printf '\n'
export FALAAI_TEST_A_EMAIL FALAAI_TEST_A_PASSWORD FALAAI_TEST_B_EMAIL FALAAI_TEST_B_PASSWORD
node --test tests/occurrences.integration.cjs
unset FALAAI_TEST_A_EMAIL FALAAI_TEST_A_PASSWORD FALAAI_TEST_B_EMAIL FALAAI_TEST_B_PASSWORD
```

Sem as quatro variáveis, o teste declara SKIP, não aprovação de RLS remoto. Conferir
no painel a remoção de fixtures se houver interrupção ou falha de limpeza.

## Roteiro Samsung Galaxy S23 Ultra

1. Reutilizar o Development Build com AsyncStorage já instalado. Conectar ao Metro
   existente na worktree. Se não houver um ativo, executar `npx expo start --dev-client`
   na raiz e abrir o app na mesma rede. Não iniciar um segundo Metro.
2. Entrar com conta A. Atualizar a Home e distinguir carregamento, vazio real e
   falha. Verificar contadores só de A e Perfil com nome/e-mail corretos.
3. Criar relato com endereço manual e sem GPS. A descrição tem 20–400 caracteres.
   Enviar uma vez (tentar duplo toque); sucesso só depois da resposta do servidor.
   Conferir no painel a linha, UUID e `author_id` da conta A.
4. Criar outro com GPS no local real. Conferir coordenadas numéricas nos detalhes,
   marcador no Mapa, filtros e endereço opcional. Não inventar coordenadas.
5. Testar câmera/galeria e prévia vertical/horizontal. Salvar sabendo que a foto
   não será anexada. Conferir `photo_path` nulo no banco para esses novos registros
   e o aviso dos detalhes, sem foto temporária fingindo persistência.
6. Fechar completamente o app e reabrir. A sessão e os relatos devem reaparecer;
   comparar UUID/descrição no painel. Repetir logout/login, sem perder registros.
7. Nos detalhes de A, editar categoria, descrição e endereço; atualizar/remover
   GPS quando apropriado. Salvar e conferir Detalhes, Home, filtros/marcadores e
   Perfil. Reiniciar e conferir os mesmos valores persistidos.
8. Excluir: primeiro cancelar e conferir que nada mudou; depois confirmar.
   Verificar remoção das listas/mapa, contadores e banco. Reiniciar para conferir
   que não reaparece. Registro excluído deve mostrar ausência, não erro de rede.
9. Sair e entrar com conta B. Home/Perfil não mostram os relatos de A como próprios.
   Mapa pode mostrá-los por leitura comunitária autorizada. Abrir um relato de A:
   sem botões de editar/excluir. Rodar o teste remoto A/B acima ou o SQL rollback
   para provar que uma chamada direta também é bloqueada pela RLS.
10. Desligar rede e testar atualização e mutações. Não mostrar sucesso fictício nem
    vazio como falha. Reativar rede, atualizar antes de repetir uma gravação cuja
    resposta se perdeu e conferir ausência de duplicação.
11. Alternar telas durante consultas e após editar/excluir. Trocar de conta durante
    consulta para verificar que respostas antigas não aparecem na sessão seguinte.

Sem novo APK necessário para esta rodada. CRUD real e RLS A/B só devem ser
considerados validados após executar esses testes no destino/aparelho.

## Resultado local desta implementação — 21/11/2026

- TypeScript estrito sem emissão: aprovado.
- Testes locais: 46 aprovados (25 da base + 21 novos do serviço/cache CRUD).
- Teste remoto opt-in: 1 SKIP por ausência das duas contas no ambiente Node.
- Bundles finais Android e web: HTTP 200 pelo Metro existente, sem segundo servidor.
- `git diff --check`: aprovado; `.env.local` ignorado e arquivos CRUD versionáveis.
- Expo 57.0.20, React Native 0.86.3, AsyncStorage 2.2.0, applicationId, projectId e
  perfil development preservados. Nenhuma dependência ou configuração nativa nova.
- CRUD/RLS real e apresentação visual no Samsung: aguardam validação pelo roteiro.
