# Prova III — validação RLS e condição para o bônus LGPD

## Situação em 23/11/2026

Validação no Samsung informada pelo aluno: autenticação, sessão, CRUD, fotografias,
login A/B, leitura comunitária no mapa e ausência de ações de edição/exclusão para
outro autor. A conta B já está confirmada; a pendência de confirmação de 21/11 foi
superada. Isso ainda não comprova a autorização das chamadas diretas à API.

A validação remota automatizada continua pendente: a conta A retornou
`invalid_credentials`, enquanto B autenticou. O carregamento local foi verificado:
aspas são removidas e os caracteres especiais são preservados, sem revelar valores.
Nenhuma falha de RLS foi comprovada, mas o RLS também não foi aprovado.
Não repetir autenticação A sem autorização.

Em 24/11/2026 foi autorizada a preparação LOCAL do bônus em paralelo.
Aviso, checkbox, migração e Edge Function foram preparados, sem aplicar ou implantar.
A exclusão permanece indisponível na interface. Ver `PROVA-III-LGPD.md`.

## Preparação segura dos testes

Crie localmente `.env.rls-test.local` na raiz, já coberto pelo `.gitignore`.
Não envie seu conteúdo pelo chat, não versione e não use prefixo EXPO_PUBLIC para
senhas. Configure nele:

```dotenv
FALAAI_TEST_A_EMAIL=
FALAAI_TEST_A_PASSWORD=
FALAAI_TEST_B_EMAIL=
FALAAI_TEST_B_PASSWORD=
FALAAI_TEST_PROJECT_REF=
FALAAI_STORAGE_TEST_APPROVED=yes
```

Use duas contas confirmadas e distintas do projeto `falaai-prova3`. O project ref
é o identificador do painel Supabase, não o nome do projeto. A URL e a chave
publishable continuam em `.env.local`. Não use service_role.

Verifique que o arquivo está ignorado:

```sh
git check-ignore .env.rls-test.local
```

Execute a partir da raiz, sem imprimir o conteúdo dos arquivos:

```sh
node --env-file=.env.rls-test.local --test tests/occurrences.integration.cjs
node --env-file=.env.rls-test.local --test tests/storage.integration.cjs
```

Os testes comparam o project ref explicitamente informado com a configuração
pública. Criam registros isolados e usam JWTs reais de A/B; o cliente anônimo
não faz login. Não usam chave administrativa. A limpeza atua somente nos IDs e
caminhos criados pela própria execução, sem drenar a fila geral de fotografias.
Em caso de interrupção ou erro de limpeza, confira as fixtures no painel antes
de repetir. Não exclua relatos anteriores para executar estes testes.

Cobertura: leitura comunitária; bloqueio de alteração/exclusão por outro autor;
bloqueio de transferência de autoria; bloqueio de gravação/exclusão de fotos
alheias; ausência de acesso anônimo; persistência, substituição e limpeza dos
arquivos isolados. SKIP não equivale a aprovação.

## Próxima etapa condicionada

Preparação local autorizada; a ativação continua dependente de testes de segurança,
migração confirmada e validação da operação de exclusão em conta descartável.
A exclusão deverá respeitar a fila de limpeza e a FK restritiva do registro de
fotografias, permitir retomada após falha parcial e remover a identidade apenas
após confirmar a remoção dos arquivos e registros. Chave administrativa somente
na Edge Function. Migrações e implantação remotas exigem confirmação separada.
