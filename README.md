# FalaAí — Prova III

Aplicativo acadêmico de relatos urbanos com React Native, Expo SDK 57, TypeScript e Supabase. Entrega até **27/11/2026**.

**Ambiente de avaliação:** `falaai-lgpd-validacao` (Ref `ilkprwaxszztejsasmcs`). A Release Candidate foi homologada no Samsung Galaxy S23 Ultra. A migração LGPD do projeto original `falaai-prova3` foi adiada; os dois projetos foram preservados.

## Funcionalidades

- Cadastro/login reais, logout e restauração/renovação da sessão.
- CRUD persistente de ocorrências; Home/Perfil mostram relatos próprios e Mapa apresenta relatos comunitários autorizados.
- Stack e Bottom Tabs, FlatList, formulários e validações, estados vazios/erros/carregamento.
- Câmera, galeria, GPS e mapa MapLibre/OpenFreeMap com coordenadas reais, marcadores e filtros.
- Fotografias persistidas em bucket privado, sem recorte obrigatório; URLs temporárias e substituição/limpeza de arquivos.
- Aviso de privacidade, checkbox inicialmente desmarcado e aceite com versão/data no servidor.
- Exclusão de conta com reautenticação, confirmação, limpeza recuperável e remoção de Auth somente ao concluir dependências.

Relatos e fotos podem ser consultados por outros usuários autenticados conforme RLS. Não há integração oficial com prefeitura nem garantia de resolução dos relatos.

## Executar a versão acadêmica no Android

1. Usar Node 24 e instalar dependências com `npm ci`. Instalar no aparelho o **Development Build Android já validado**, cujo APK/link oficial será fornecido pelo responsável por canal privado. Expo Go não contém todos os módulos nativos usados; estas alterações JS não exigiram APK novo.
2. Criar `.env.academic.local` na raiz com somente estes dois campos, preenchidos com a configuração PÚBLICA do ambiente acadêmico fornecida pelo responsável:

   ```dotenv
   EXPO_PUBLIC_SUPABASE_URL=https://ilkprwaxszztejsasmcs.supabase.co
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
   ```

   Nunca inserir Secret API key, service_role, senha de banco ou credenciais de usuário. Não copiar arquivos administrativos do responsável.
3. Executar:

   ```sh
   node scripts/start-academic.cjs --check
   node scripts/start-academic.cjs
   ```

4. Computador e Samsung na mesma rede; abrir o projeto no Development Build pelo QR/link mostrado pelo Metro. Encerrar o Metro anterior antes de iniciar outro.
5. Usar a conta dedicada de avaliação entregue privadamente. Não há senha no código/README. Não usar a conta preservada B para testes destrutivos.

O lançador usa apenas URL/Publishable Key, desabilita carregamento automático de dotenv e não substitui `.env.local` do principal. Não exige branch específica nem arquivos com chave administrativa. O painel de exclusão fica disponível, mas a trava do servidor permanece **disabled** fora da janela autorizada. Um HTTP 503 disabled não é defeito de instalação.

Para executar o principal, encerrar o Metro acadêmico e o app, configurar `.env.local` conforme `.env.example` e usar `npx expo start --dev-client --clear`. Isso não implanta LGPD no principal.

## Validação e limites

- Homologação física: Auth/sessão, CRUD/fotos, câmera/GPS/mapa; 13 testes iniciais de UI LGPD, 15 finais de exclusão e 13 regressões da RC informados pelo responsável.
- Exclusão real validada no descartável, inclusive com 250 fotos nos testes integrados; conta A removida e B preservada, inclusive integridade binária das fotos.
- 147 testes locais no fechamento da preparação; TypeScript, bundling Android dev/Hermes e exports Android/web passaram na RC. ESLint da RC ficou em zero erros/avisos, usando ferramentas externas fixas sem atualizar dependências.
- **Cadastro público com aceite e confirmação de e-mail no descartável segue pendente** por limitação do serviço; conta de avaliação foi confirmada via Admin, o que não substitui esse teste. Não usar example.com para comprovar recebimento de e-mail.
- LGPD não implantada no principal. Backup lógico PostgreSQL 17 do principal foi concluído e decodificado, mas **restauração efetiva não foi comprovada**, por indisponibilidade de terceiro projeto gratuito. Backup privado não integra este repositório.
- Falha real injetada no runtime Deno e espera real de 24h não foram executadas; os testes locais/híbridos não equivalem a esses cenários remotos.
- EAS Update não publicado. Não é aplicativo pronto para produção comercial nem certificação jurídica de LGPD.

Comandos locais:

```sh
node --experimental-strip-types --test tests/*.test.cjs
./node_modules/.bin/tsc --noEmit
git diff --check
```

ESLint não é dependência permanente; `npm run lint` pode propor instalações. Não aceitar instalação automática sem revisão. Não executar scripts de fixtures, backup ou exclusão como parte do teste normal do professor.

## Código para apresentar

| Área | Arquivos |
| --- | --- |
| Telas e navegação | `src/screens/`, `src/navigation/AppNavigator.tsx` |
| Estado e sessão | `src/context/AppContext.tsx`, `src/lib/supabase.ts`, `src/services/auth.ts` |
| CRUD | `src/services/occurrences.ts`, `src/services/occurrence-store.ts` |
| Fotografias | `src/services/occurrence-photos.ts`, `src/services/occurrence-media.ts` |
| Privacidade/exclusão | `src/lib/privacy.ts`, `src/services/account-deletion.ts`, `src/components/account-deletion-panel.tsx` |
| Segurança servidor | `supabase/migrations/`, `supabase/functions/delete-account/` |
| Testes | `tests/` |

O estilo cartográfico é OpenFreeMap Liberty; a atribuição nativa OpenFreeMap/OpenMapTiles/OpenStreetMap é preservada. O provedor público não oferece SLA e deve ser reavaliado antes de uso em escala. Coordenadas numéricas ficam nos detalhes, sem substituir o endereço nos cartões.

## Entrega e demonstração

[Procedimento final e roteiro de gravação](docs/PROVA-III-ENTREGA-FINAL.md) · [Validação mobile](docs/PROVA-III-CONCLUSAO-MOBILE.md) · [Release Candidate](docs/PROVA-III-RELEASE-CANDIDATE.md) · [Backup e recuperação pendente](docs/PROVA-III-CONEXAO-BACKUP.md).

Não aplicar migrações nem habilitar exclusão para simplesmente executar o projeto. O ambiente acadêmico já está configurado. Alterações no principal permanecem adiadas para depois da prova.
