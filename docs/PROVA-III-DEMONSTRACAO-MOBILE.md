# Demonstração mobile no projeto descartável

## Diagnóstico e validações

Os logs Auth das últimas 24 horas do projeto `falaai-lgpd-validacao` contêm `over_email_send_rate_limit` e HTTP 429, com mensagem de limite de e-mails. Existem também erros históricos `email_address_invalid`; não foi encontrado `email_address_not_authorized` nessa amostra. Não foi provocado novo cadastro público para reproduzir o bloqueio.

Antes de preparar as contas de demonstração, o inventário Auth retornou zero usuários, inclusive zero usuários não confirmados. Portanto não havia conta parcial persistida naquele instante.

Foram criadas duas contas fictícias por Auth Admin, com e-mail confirmado e metadata de privacidade versão `2026-11-24-v1`. Login pela Publishable Key, leitura do próprio perfil e registro de aceite com data do servidor passaram para ambas. A confirmação administrativa não valida entrega de e-mail.

Cadastro público com aceite e confirmação por e-mail continuam PENDENTES. Não foram alterados limites, confirmação global ou migrações.

## Credenciais locais

Abra `.env.lgpd-demo.local` na raiz da worktree pelo VS Code. O arquivo contém os campos `DEMO_A_EMAIL`, `DEMO_A_PASSWORD`, `DEMO_B_EMAIL`, `DEMO_B_PASSWORD` e os identificadores das contas. Está ignorado pelo Git, com permissão de arquivo 0600 e bloqueado no Metro. Não compartilhe seu conteúdo nem o inclua em capturas de tela. Nenhuma chave administrativa foi copiada para esse arquivo.

O script `scripts/prepare-lgpd-demo.cjs` preserva o arquivo existente e recusa repetição caso ele já exista. As duas contas são mantidas para os testes físicos, não devem ser incluídas na limpeza de execuções anteriores.

## Roteiro mínimo no Samsung

1. Utilize o Metro isolado já aberto. Se estiver parado, na worktree execute `node scripts/start-lgpd-ui.cjs`; não abra outro Metro simultâneo.
2. No Development Build, entre com a conta A usando os valores do arquivo local. Confirme restauração da sessão após reiniciar.
3. Abra Perfil e consulte o aviso de privacidade.
4. Abra Excluir minha conta, confira o campo de senha e cancele. A conta deve continuar conectada.
5. A trava remota permanece desabilitada: uma solicitação deve informar indisponibilidade, sem apagar dados nem encerrar a sessão. Não se trata de teste de senha incorreta, pois a trava pode ser verificada antes da reautenticação.
6. Saia e entre com B. Confirme separação dos relatos próprios e navegação comunitária normal.
7. Para testar exclusão real pela interface será necessária autorização posterior para habilitar temporariamente a função no projeto descartável. Esta rodada não realizou exclusões.

## Resultado local

142 testes aprovados; TypeScript sem emissão, `git diff --check` e preflight do lançador aprovados. `.env.local` principal permaneceu byte a byte inalterado. Nenhum novo APK é necessário para a alteração de mensagem.
