# FalaAí

Protótipo acadêmico de participação cidadã com Expo SDK 57, React Native, TypeScript e React Navigation. Permite relatar problemas com descrição, foto e localização, sem backend. Preparação para a segunda prova de 20/10/2026.

## Estado validado

O Development Build Android com MapLibre foi gerado, instalado e testado em aparelho físico. Conforme a validação realizada pelo responsável pelo projeto, foram aprovadas 21 verificações funcionais e 12 verificações de UI/UX. Foram testados login, cadastro, navegação, câmera, galeria, GPS, mapa MapLibre com OpenFreeMap, ruas e bairros, marcadores, detalhes e filtros.

As fotografias são exibidas completas na prévia e nos detalhes, sem recorte obrigatório solicitado pelo aplicativo. Os cartões priorizam categoria, status, descrição, localização e data; coordenadas numéricas ficam nos detalhes, além do feedback de captura de GPS no formulário.

TypeScript, os 11 testes automatizados e `git diff --check` passaram na última rodada. O projeto continua sem backend, com dados temporários em memória. **EAS Update não foi publicado.**

## Executar pelo Metro e Development Build

Use Node 24 para executar os testes existentes. No diretório do projeto, instale as dependências na primeira execução ou após mudanças no lockfile:

```bash
npm ci --no-audit --no-fund
```

Inicie o Metro:

```bash
npx expo start --dev-client
```

No Android, abra o FalaAí no Development Build já instalado e conecte-o ao endereço do Metro mostrado no terminal. Mantenha computador e celular com conectividade entre si, normalmente na mesma rede Wi-Fi. O build Android existente pode ser reutilizado; não é preciso gerar outro APK apenas por trocar a pasta do projeto ou alterar JavaScript/TypeScript. A plataforma iOS não foi validada nesta entrega. Expo Go não contém o módulo nativo MapLibre. A câmera precisa de aparelho físico para uma demonstração real. Simuladores dependem dos recursos disponíveis e de localização simulada, que não equivale a testar GPS real.

Para web, execute `npm run web`. O mapa integrado utiliza um componente exclusivo de Android/iOS; na web há uma lista de ocorrências. As coordenadas e o acesso ao OpenStreetMap estão nos detalhes dos registros com GPS.

Conta de demonstração: `teste@email.com`, senha `123456`. Também é possível criar contas durante a sessão. Use somente dados fictícios e uma senha de teste.

## Funcionalidades e organização

- Login e cadastro demonstrativos com validação e e-mail normalizado como identidade. Nomes iguais não misturam as listas pessoais.
- Stack: Login ou fluxo autenticado com abas, Nova ocorrência e Detalhes. O navegador troca o fluxo ao mudar a sessão; sair remove as telas internas do histórico.
- Bottom Tabs: Início, Mapa e Perfil.
- Início usa FlatList com cabeçalho, cartões, chaves estáveis, separadores e estado vazio.
- Nova ocorrência oferece seis categorias compartilhadas, câmera ou galeria, prévia/remover foto, descrição de 20 a 400 caracteres e endereço ou GPS. O seletor usa `allowsEditing: false`, sem proporção de recorte forçada. Prévia e detalhes usam `contain` e altura ajustada à proporção da imagem, sem distorção. Câmeras externas podem oferecer edição própria; a API pode processar o arquivo. Fotos recortadas anteriormente precisam ser selecionadas novamente para recuperar o enquadramento original.
- GPS solicita apenas acesso em primeiro plano, interrompe a busca no primeiro resultado, após 20 segundos ou ao sair da tela. Não rastreia em segundo plano. Endereço manual permite continuar sem GPS.
- Mapa usa MapLibre React Native e o estilo Liberty do OpenFreeMap, sem chave de API ou cartão, e mostra apenas coordenadas reais capturadas. Registros sem GPS aparecem na lista, sem marcador inventado. Há filtros por categoria, estado vazio e opção de mostrar só a lista.
- Detalhes recebem o ID e consultam o registro no contexto, com tratamento de ocorrência ausente e foto indisponível. Abrir mapa externo é uma ação explícita do usuário e envia as coordenadas ao serviço de mapas.
- Perfil calcula contadores a partir dos registros do usuário e encerra a sessão.
- Áreas seguras, formulário com ajuste de teclado, botões com rótulos/estados acessíveis, textos que podem quebrar linha e conteúdo limitado a 800 pontos em telas grandes.

```text
App.tsx                       SafeAreaProvider e AppProvider
src/types/index.ts            Modelos e parâmetros de navegação
src/context/AppContext.tsx    Estado compartilhado e sessão demonstrativa
src/navigation/               Stack e Bottom Tabs
src/screens/                  Seis telas do aplicativo
src/constants/categories.ts   Categorias compartilhadas
src/components/app-ui.tsx     Botão, aviso, área segura, cabeçalho e foto
src/components/occurrence-map.native.tsx  Mapa Android/iOS
src/components/occurrence-map.tsx         Alternativa web
src/utils/validation.ts        Validação de e-mail e IDs
src/utils/map-viewport.ts      Conversão de coordenadas e enquadramento
src/constants/maps.ts          URL pública do estilo Liberty
```

Os outros componentes de tema/template ainda presentes em `src/components` não são utilizados pelo fluxo principal. Não há roteamento por arquivos/Expo Router.

## Persistência e limites da demonstração

A solução de armazenamento foi avaliada, mas **esta rodada mantém contas e ocorrências somente em memória**. Elas sobrevivem à troca de abas e ao logout/login dentro da mesma execução, mas não a reload, encerramento do processo ou reinício. O logout limpa o usuário atual; a lista comunitária continua disponível para as outras contas na mesma execução.

O projeto não declara uma dependência própria de armazenamento. Para evitar uma dependência adicional de armazenamento nesta etapa, não foi introduzido armazenamento dependente de pacote transitivo nem armazenamento de credenciais. Nenhuma senha é gravada em disco ou enviada a servidor. A conferência de senha em memória é apenas demonstrativa e não constitui autenticação segura de produção.

Uma próxima etapa possível é declarar `expo-file-system` diretamente, gravar os registros em JSON no diretório de documentos e copiar as fotos do cache para esse diretório antes de confirmar o salvamento. Isso exigirá tratar hidratação, falhas de leitura/escrita e recuperação de dados. Não se deve gravar as senhas demonstrativas nesse JSON.

As fotos atuais são URIs retornadas pelo seletor e podem apontar para cache temporário. Não há promessa de conservação após encerrar o aplicativo; a tela de perfil informa essa limitação. Para a apresentação, crie os registros durante a sessão e não recarregue o aplicativo entre cadastro e demonstração.

Todas as novas ocorrências começam como “Aberta”. Não há prefeitura conectada, edição de status ou backend. “Em aberto” conta tudo que ainda não está resolvido; “Resolvidas” filtra o status correspondente, sem um número artificial fixo.

## Compatibilidade e permissões

Foi instalada a versão **11.5.0** de `@maplibre/maplibre-react-native`, cuja compatibilidade declarada exige Expo ≥54, React Native ≥0.80 e React ≥19.1. O projeto mantém Expo `~57.0.20`, React Native `0.86.3` e React `19.2.3`. A v11 requer a Nova Arquitetura, utilizada pelo React Native deste projeto. A compilação nativa e os testes no Android já foram realizados. A compatibilidade declarada e os bundles, isoladamente, não substituem esses testes; mudanças nativas futuras exigem nova validação.

O componente usa a API da versão instalada: `Map`, `Camera`, `Marker`, `mapStyle`, `lngLat`, `initialViewState`, `easeTo` e `fitBounds`. `padding` é um objeto de insets; não são usados exemplos antigos com `MapView`, `styleURL` ou `coordinate` de versões anteriores.

O plugin `@maplibre/maplibre-react-native` está registrado em `app.json`, junto dos plugins de câmera, localização, splash e `expo-dev-client`. Não há configuração de chave Google nem dependência `react-native-maps`. O link externo nos detalhes utiliza OpenStreetMap.

O estilo público é [OpenFreeMap Liberty](https://tiles.openfreemap.org/styles/liberty), que fornece ruas, bairros e outros rótulos conforme cobertura dos dados e nível de zoom. Os dados são do OpenStreetMap com esquema OpenMapTiles. O controle nativo de atribuição permanece habilitado e utiliza os créditos da fonte: OpenFreeMap, © OpenMapTiles e OpenStreetMap. Não esconda a atribuição. Consulte o [guia do provedor](https://openfreemap.org/quick_start/) e suas [condições e atribuição](https://openfreemap.org/).

O serviço público não exige cadastro, chave ou cartão e não oferece SLA. Antes de uma implantação com grande quantidade de usuários, reavalie disponibilidade, política de uso, privacidade, suporte e eventual hospedagem própria. A gratuidade do mapa não garante builds gratuitos no EAS, que mantém seus próprios limites.

O mapa mostra carregamento, trata o evento nativo de falha e apresenta erro após 20 segundos sem completar a renderização inicial. É possível tentar novamente ou usar a lista abaixo. Falhas de recursos individuais após a carga inicial podem depender dos eventos emitidos pelo SDK e precisam de teste em aparelho. Não há download offline ou garantia de cobertura dos dados. Os pedidos de tiles/estilo são enviados ao OpenFreeMap, e a região visualizada pode ser inferida por esses pedidos; o aplicativo não envia o formulário ou a foto ao provedor de mapas.

`app.json` configura mensagens de câmera, fotos e localização em primeiro plano. O acesso ao microfone foi desabilitado para o seletor de fotos. Mudanças de plugins de permissão exigem reconstrução de um binário próprio; no Expo Go são usadas as permissões do aplicativo hospedeiro.

Referências antigas a ícones, favicon e splash inexistentes foram removidas da configuração. Não foram inventados novos arquivos de identidade visual. Ícones de publicação personalizados ficam para uma etapa posterior.

## Verificações executáveis

```bash
./node_modules/.bin/tsc --noEmit --incremental false
node --test tests/*.test.cjs
git diff --check
```

Os testes usam o suporte a TypeScript do Node 24, sem biblioteca nova. Cobrem normalização de identidade, e-mails inválidos, colisões de IDs no mesmo milissegundo, integridade das categorias, ordem longitude/latitude, enquadramento de pontos e configuração das plataformas sem exigência de chave.

Para conferir bundling sem publicar:

```bash
CI=1 EXPO_NO_TELEMETRY=1 ./node_modules/.bin/expo export --platform all --output-dir /private/tmp/falaai-prova-export --no-minify
```

Não há ESLint instalado/configurado; o script legado `npm run lint` chama `expo lint`, que pode propor instalação. Ele não foi executado para evitar alterar dependências. Bundling e TypeScript não substituem teste em aparelho.

## Roteiro de teste e apresentação

1. Inicie o aplicativo. Tente entrar sem preencher os campos e com e-mail inválido/senha curta. Confira as mensagens.
2. Entre com a conta demonstrativa. Confira a Home vazia, saudação e indicadores em zero.
3. Abra Nova ocorrência, tente salvar sem descrição/localização e com uma descrição de 19 caracteres. O salvamento deve ser bloqueado. Espaços externos não contam para o mínimo.
4. Selecione uma categoria. Tire uma foto, confirme a prévia, remova-a e escolha outra pela galeria. Cancele o seletor uma vez: a foto anterior deve permanecer.
5. Negue permissões de câmera/galeria e confira o aviso. Libere o acesso nos ajustes e repita. Não é obrigatório anexar foto para registrar.
6. No local do problema, capture o GPS e confira latitude/longitude. Negue a permissão, desligue a localização e teste também a falha. A alternativa é digitar endereço manualmente. Permissões podem exigir reset pelos ajustes entre os casos.
7. Preencha uma descrição com 20 ou mais caracteres úteis e registre. A confirmação deve aparecer uma vez. Volte ao Início e confira cartão, total e “Em aberto”.
8. Abra os detalhes e confira categoria, foto, descrição, endereço, coordenadas, autor e data. Volte e confira a lista preservada.
9. Cadastre outra ocorrência somente com endereço. Na aba Mapa, confira que apenas a primeira possui marcador GPS. As duas devem constar na lista.
10. Teste os filtros, incluindo categoria sem registros. Toque em um marcador/cartão e abra os detalhes. Teste a opção de lista e o mapa externo.
11. Confira Perfil, nome longo, e-mail e contadores. Saia: Login deve aparecer e o Voltar do Android não deve reabrir telas autenticadas.
12. Crie outra conta com o mesmo nome e e-mail diferente. A Home deve estar vazia; o Mapa continua comunitário. Saia e entre novamente na conta anterior: seus registros devem continuar disponíveis nessa execução.
13. Teste cadastro com e-mail já existente, com espaços/maiúsculas, e login com senha incorreta.
14. Teste tela estreita, teclado aberto, rolagem do formulário, textos grandes e áreas seguras. Crie vários registros e percorra a FlatList.
15. Reinicie o aplicativo e confirme a limitação documentada: contas criadas e registros são apagados; a conta demonstrativa volta ao estado inicial.

## Conceitos para explicar na prova

- **Estado e Context:** `useState` mantém os dados da execução; `AppProvider` permite consultar e atualizar esses dados em telas diferentes. Estado em memória não é persistência.
- **Imutabilidade:** `[report, ...previous]` cria um array novo, permitindo que React e FlatList percebam a atualização.
- **FlatList:** `data` fornece os registros; `renderItem` desenha o cartão; `keyExtractor` identifica pelo ID; `ListHeaderComponent` preserva o topo; `ListEmptyComponent` resolve ausência de dados. Ela virtualiza a lista, enquanto ScrollView com `map` monta todos os filhos.
- **Identidade:** o e-mail normalizado distingue usuários com o mesmo nome. O ID de ocorrência combina tempo e contador para evitar colisões na mesma execução.
- **Navegação:** Stack mantém o histórico entre telas; Tabs alterna áreas principais. A sessão determina quais rotas existem. Detalhes recebem um ID tipado e consultam a fonte de dados.
- **TypeScript:** tipos de usuário, ocorrência, coordenadas, categoria e rotas ajudam a impedir acessos incorretos em tempo de desenvolvimento; não garantem sozinhos o comportamento do aparelho.
- **Formulários:** campos controlados ligam `value`/`onChangeText` ao estado. Validação usa texto normalizado e só permite registrar dados válidos.
- **Recursos nativos:** galeria escolhe arquivo existente; `launchCameraAsync` captura uma foto nova; localização retorna latitude/longitude reais. Endereço textual não é convertido automaticamente em coordenadas.
- **Assincronismo:** `async/await`, `try/catch/finally`, bloqueio de ações concorrentes e cancelamento da busca de GPS mantêm o fluxo previsível.
- **Permissões:** são solicitadas ao usar o recurso. Negação não impede o uso das alternativas manuais; não há solicitação de localização em segundo plano.
- **Plataformas:** o Metro escolhe o componente `.native.tsx` para Android/iOS; a web usa uma alternativa sem importar o mapa nativo.
- **Segurança e limites:** login local não autentica em servidor, URI não significa arquivo permanente e nenhum chamado é enviado à prefeitura.

## Checklist dos critérios

| Critério | Implementação | Estado da entrega |
| --- | --- | --- |
| Telas (2 pontos) | Login/Cadastro, Início, Mapa, Nova ocorrência, Detalhes e Perfil | Validado no Android |
| Mais de uma navegação (2 pontos) | Native Stack e Bottom Tabs | Navegação validada no Android |
| Visual, usabilidade e código (3 pontos) | Tipos, categorias compartilhadas, áreas seguras, teclado, mensagens e validações | UI/UX validada no Android; revalidar após novas alterações |
| FlatList (1 ponto) | Home e lista do Mapa | Listagens validadas no Android |
| Recursos nativos (2 pontos) | Câmera, galeria e GPS conectados ao cadastro | Câmera, galeria, GPS e mapa testados no Android |
| Backend (bônus) | Fora do escopo | Não implementado |
| EAS Update (bônus) | Não publicado | Sem publicação de EAS Update |

Os testes no Android foram concluídos pelo responsável pelo projeto. O roteiro acima permanece como referência de apresentação e regressão; a pontuação depende da avaliação do professor.

## Android Development Build com MapLibre

A identidade foi preservada: application ID `com.ivysonsiqueira.falaai`, projeto EAS `f0217604-bc3e-45a0-a88d-94e33fd7aba8` e owner `ivysonsiqueira`. O perfil `development` continua com `developmentClient: true`, `distribution: internal` e ambiente `development`. Keystore e credenciais remotas não são alterados pela migração. `app.config.js` apenas preserva a configuração estática, sem ler variáveis de mapas.

Não é necessário configurar Google Cloud, faturamento, chave de API ou restrição SHA-1 para os mapas. Se uma variável antiga de mapas ainda existir no painel EAS ou em arquivo local, ela é ignorada por esta implementação; a migração não modifica arquivos de credenciais nem remove valores remotos automaticamente.

MapLibre não funciona no Expo Go nem em um APK antigo que não contenha seu módulo. O Development Build Android com MapLibre já foi gerado e validado. Ele pode ser reutilizado para executar o código atual pelo Metro. Um novo APK é necessário quando houver mudanças nativas que o binário instalado ainda não contenha; a instalação JavaScript sozinha ou um EAS Update não acrescenta módulos nativos. Nenhum EAS Update foi publicado nesta entrega.

### Reconstrução futura — somente se necessária

Os comandos desta seção documentam uma eventual reconstrução e não são necessários para iniciar o aplicativo já instalado. Antes de reconstruir, confirme a conta e a vinculação existente, sem recriar o projeto:

```bash
npx eas-cli whoami
npx eas-cli project:info
```

Se necessário, entre na conta com `npx eas-cli login`. Reutilize as credenciais Android existentes; não gere outro keystore apenas por trocar a biblioteca de mapas. Depois de autorização explícita, gere o Development Build:

```bash
npx eas-cli build --platform android --profile development
```

O EAS fornece um link/QR para baixar o APK. Abra esse link no Android, baixe e instale o FalaAí, autorizando a instalação por essa origem quando o sistema solicitar. Como alternativa, com Android Platform Tools configurado e depuração USB autorizada:

```bash
adb install -r /caminho/real/do/falaai.apk
```

Use o caminho real do arquivo baixado. Se ocorrer incompatibilidade de assinatura, confira qual keystore assinou cada APK antes de considerar reinstalação. Não desinstale automaticamente o aplicativo.

Após instalar, inicie o servidor de desenvolvimento:

```bash
npx expo start --dev-client
```

Abra o aplicativo FalaAí instalado e conecte-o ao Metro. O Development Build depende desse servidor para a execução normal de desenvolvimento; não é um APK final autônomo de apresentação.

### Roteiro de regressão Android após futuras alterações

1. Capture uma localização real e cadastre uma ocorrência. Confira ruas/bairros no mapa e a posição do marcador.
2. Toque no marcador e confira os detalhes. Teste os filtros, inclusive categoria sem registros.
3. Cadastre outro ponto e confira o enquadramento; pontos coincidentes não devem provocar zoom indefinido.
4. Confira o botão de atribuição e os créditos OpenMapTiles/OpenStreetMap.
5. Desligue a rede antes de abrir o mapa, aguarde o tratamento de falha e teste nova tentativa. A lista deve continuar utilizável.
6. Teste a web com `npm run web`: deve continuar usando a lista e o link OpenStreetMap nos detalhes, sem importar o módulo nativo.
7. Teste câmera, galeria, GPS e retorno entre telas após mudanças. Confira fotos verticais e horizontais completas na prévia e nos detalhes, sem recorte obrigatório do FalaAí. Os registros não são transferidos entre execuções, pois o armazenamento continua em memória.

Referências: [requisitos MapLibre](https://maplibre.org/maplibre-react-native/docs/setup/getting-started/), [plugin Expo](https://maplibre.org/maplibre-react-native/docs/setup/expo/), [OpenFreeMap](https://openfreemap.org/), [development builds](https://docs.expo.dev/develop/development-builds/introduction/).
