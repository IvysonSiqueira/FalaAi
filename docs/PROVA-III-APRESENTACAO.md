# Checklist de apresentação da Prova III

Conclusão indicada: 24/11/2026. Fechamento dos envios informado: 27/11/2026.
Priorizar gravação/entrega dos requisitos obrigatórios sem esperar o bônus.
Nenhum vídeo foi gravado ou voz sintetizada automaticamente.

## Antes de gravar

- [ ] Usar APK Development Build validado e projeto principal já funcional.
- [ ] Não trocar .env.local por dados do projeto descartável.
- [ ] Usar dados de demonstração, sem informações pessoais de terceiros.
- [ ] Não abrir .env, tokens, keys, senha ou URLs assinadas no vídeo.
- [ ] Conferir limite/formato da atividade e links de entrega na plataforma.
- [ ] Separar vídeo do Samsung e vídeo do VS Code se isso facilitar a entrega.

## Demonstração Samsung / explicação VS Code

| Ação | Arquivos e conceito a explicar |
| --- | --- |
| Cadastrar, confirmar e-mail e entrar | src/screens/LoginScreen.tsx; src/services/auth.ts — operação assíncrona e Supabase Auth |
| Reabrir e recuperar sessão; sair e reiniciar desconectado | src/lib/supabase.ts; src/context/AppContext.tsx — AsyncStorage, sessão e renovação |
| Criar ocorrência com GPS/foto | src/screens/NewReportScreen.tsx — permissões, validação e sucesso após servidor |
| Mostrar ocorrência própria na Home | src/screens/HomeScreen.tsx — FlatList, UUID e filtro por proprietário |
| Mostrar Mapa comunitário, marcador e filtros | src/screens/MapScreen.tsx; src/components/occurrence-map.native.tsx — MapLibre e coordenadas reais |
| Abrir detalhes e editar descrição/foto | src/screens/ReportDetailScreen.tsx; src/services/occurrences.ts — Read/Update pelo UUID |
| Reiniciar e recuperar foto | src/services/occurrence-photos.ts; src/components/stored-report-photo.tsx — caminho persistido e URL temporária |
| Conferir coerência de todas as telas | src/context/AppContext.tsx; src/services/occurrence-store.ts — estado compartilhado e respostas atrasadas |
| Excluir somente ocorrência criada para o vídeo | src/services/occurrence-media.ts — banco, Storage e recuperação da limpeza |
| Mostrar Perfil com contadores e logout | src/screens/ProfileScreen.tsx — dados persistidos do usuário |
| Explicar proteção no servidor | supabase/migrations/20261121000100_initial_profiles_occurrences.sql; 20261121000200_occurrence_photos_storage.sql — grants, RLS, auth.uid() e bucket privado |

## O que declarar com precisão

- Validado no Samsung pelo aluno: Auth, sessão, CRUD, fotos e operações principais.
- Testes Node e TypeScript são verificações locais; não provam RLS remoto.
- UI esconde editar/excluir de outro autor; bloqueio direto de API ainda precisa
  de teste com duas contas autenticáveis.
- LGPD: aviso/checkbox e servidor preparados; aceite formal depende da migração,
  exclusão permanece indisponível. Não reivindicar bônus completo sem validação.
- Não existe acompanhamento oficial da prefeitura nem atualização automática de status.

## Finalização

- [ ] Assistir vídeos exportados e conferir áudio/texto legíveis.
- [ ] Conferir permissão de acesso dos links sem sessão pessoal.
- [ ] Enviar versão obrigatória dentro do prazo indicado pela plataforma.
- [ ] Não adiar toda a apresentação esperando implantação do bônus.
