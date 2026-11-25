# Correção do bundling Android de desenvolvimento

Worktree e8ce, branch codex/prova-iii-supabase. Nenhum acesso ao Supabase, migração,
ativação de exclusão, APK ou push nesta rodada.

## Causa raiz confirmada no SDK instalado

Não existiam metro.config.js/Babel personalizados, nem require.context/imports
dinâmicos do aplicativo incluindo os testes. O caminho vinha do próprio Expo 57:

1. Referências EXPO_PUBLIC_* em desenvolvimento usam expo/virtual/env por meio do
   plugin do babel-preset-expo (build/plugins/inline-env-vars.js).
2. @expo/metro-config/build/transform-worker/transform-worker.js cria nesse módulo
   virtual um require.context da raiz com expressão /^\.\/\.env/.
3. O contexto encontra TODO nome iniciado por .env, inclusive nossos manifestos e
   relatórios JSON ignorados pelo Git. O transformador dotenv reconhece apenas
   nomes padrão, não .env.lgpd-fixtures-UUID.local. O JSON acaba no Babel como JS.
4. Em produção a estratégia é diferente, com inline das variáveis. Por isso a
   exportação anterior passou e não reproduziu a falha do Metro de desenvolvimento.

EXPO_NO_DOTENV=1 desabilita o carregamento dotenv do CLI, mas não eliminava esse
require.context do SDK. Além do erro sintático, o dev context poderia ler as
variáveis públicas do .env.local principal e sobrescrever o ambiente isolado.
Arquivos privados não padrão também poderiam ser transformados como código:
ignorá-los pelo Git não é uma barreira de compilação. Nenhuma credencial foi
impressa durante o diagnóstico.

## Correção e preservação

- metro.config.js estende getDefaultConfig do Expo, mantendo regras padrão,
  extensões e suporte nativo. Acrescenta blockList; não altera node_modules/Babel.
- scripts/helpers/metro-isolation.cjs exclui .env* físicos, backups .bak/.backup/
  .orig/.tmp/~ e os diretórios da raiz scripts, tests, supabase, docs, .artifacts
  e .git. Não bloqueia dependências node_modules, assets, src ou módulos virtuais
  do Expo. Padrões funcionam em separadores macOS/Linux e Windows.
- Os .env continuam legíveis pelo Node/Expo CLI. No modo normal o CLI injeta as
  variáveis públicas; no modo isolado o lançador injeta somente o descartável.
  O contexto Metro vazio usa o process.env público preparado pelo serializador.
- Seis JSON legados de controle foram movidos, com comparação byte a byte, para
  .artifacts/lgpd/<runId>/fixtures.json e results.json. Diretórios 0700, arquivos
  0600. Nenhuma evidência foi descartada ou sobrescrita.
- .env.local, .env.lgpd-validacao.local, .env.rls-test.local e seu backup continuam
  nos locais originais. Não houve remoção genérica de arquivos .env.
- O executor lgpd-real-disposable agora cria evidências JSON no novo diretório,
  com os mesmos guards de fixtures e de autorização remota. Esta rodada não o
  executou remotamente.
- O lançador verifica também a blockList antes de iniciar. Sem a proteção do Metro,
  o preflight recusa iniciar, mesmo com URL e Publishable Key corretas.

Arquivos desta correção: metro.config.js; scripts/helpers/metro-isolation.cjs;
scripts/helpers/lgpd-artifacts.cjs; scripts/lgpd-real-disposable.cjs;
scripts/start-lgpd-ui.cjs; scripts/verify-metro-dev.cjs;
tests/metro-isolation.test.cjs; tests/lgpd-artifacts.test.cjs; .gitignore;
README.md e documentação de evidências/este relatório.

## Validação real de desenvolvimento

O processo Metro anterior foi identificado por comando/diretório e reiniciado,
sem encerrar outros aplicativos. O lançador isolado iniciou com a configuração
corrigida e cache limpo. scripts/verify-metro-dev.cjs consultou somente localhost:

| Checagem | Resultado |
|---|---|
| index.bundle Android, dev=true, lazy=false | HTTP 200 |
| index.map Android, dev=true | HTTP 200, 1195 fontes |
| Android dev lazy=true, engine=hermes | HTTP 200 |
| JSON sintético .env.lgpd-fixtures-regression-UUID.local presente na raiz durante o teste | Ignorado; bundle sem marcador privado |
| Evidências reais em .artifacts presentes | Sim, fora do grafo |
| Fontes internas, dotenv, testes e servidor no source map | Ausentes |
| Valores conhecidos de senhas/tokens/chaves administrativas locais no bundle/source map | Ausentes |
| URL e Publishable Key descartáveis | Presentes, sem imprimir valores |
| URL principal no bundle isolado | Ausente |
| Carregamento público normal pelo Expo CLI | Preservado, sem modificar .env.local |

O verificador não imprime nem salva bundles/source maps. Compara valores sensíveis
localmente em memória e retorna somente booleanos/status. O JSON sintético é de
propriedade do teste (criado com wx) e removido no finally; não remove arquivos reais.
Ausência dos valores conhecidos e do grafo privado é evidência delimitada ao bundle
verificado, não uma garantia universal sobre todo segredo desconhecido ou externo.

141 testes locais aprovados; TypeScript sem emissão e git diff --check aprovados.
Sete testes novos cobrem regras Metro, caminhos Windows, padrões Expo preservados,
local dos artefatos, preservação de ambientes e recusa de sobrescrever evidência.
Os preflights LGPD e do lançador passaram; executor validado sintaticamente e pela
cobertura dos helpers, sem iniciar sua suíte destrutiva.

O Metro temporário usado na validação foi encerrado para liberar 8081. A geração
foi de desenvolvimento, não apenas exportação de produção. A abertura/interação
física no Samsung continua sendo a validação seguinte.

## Reiniciar e validar no Samsung

No Terminal, na raiz desta worktree:

```sh
node scripts/start-lgpd-ui.cjs --check
node scripts/start-lgpd-ui.cjs
```

Se já existir Metro, encerrá-lo com Ctrl+C antes. O lançador não inicia segundo
Expo ou outra instância na porta ocupada. No Samsung, fechar completamente o
FalaAí e reabrir pelo Development Build existente, na mesma rede do Mac. Abrir o
link/QR informado pelo Metro; não usar Expo Go. Não há necessidade de novo APK.

Em outro Terminal, com esse Metro ativo, a regressão pode ser repetida:

```sh
node scripts/verify-metro-dev.cjs
```

Esperado: passed=true e status 200 nos dois bundles e source map. Manter os artefatos
reais presentes é intencional; não apagar ambientes para conseguir compilar.
A função remota continua desabilitada: esta correção não permite exclusão real.
