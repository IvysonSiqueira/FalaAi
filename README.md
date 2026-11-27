# FalaAí

### Tecnologia a serviço da participação cidadã

O FalaAí é um aplicativo mobile desenvolvido no contexto acadêmico para facilitar o registro e a visualização de ocorrências urbanas, aproximando a comunidade dos problemas presentes em seu cotidiano.

## Funcionalidades

- Cadastro e autenticação de usuários.
- Criação, consulta, edição e exclusão de ocorrências.
- Registro fotográfico por câmera ou galeria.
- Geolocalização por GPS.
- Mapa interativo com marcadores e filtros.
- Gerenciamento de perfil.
- Persistência de dados e fotografias.
- Recursos de privacidade e exclusão de conta.

## Tecnologias utilizadas

- React Native
- Expo SDK 57
- TypeScript
- Supabase
- PostgreSQL
- React Navigation
- MapLibre
- OpenFreeMap

## Estrutura do projeto

| Diretório | Responsabilidade |
|---|---|
| `src/screens` | Telas do aplicativo |
| `src/components` | Componentes reutilizáveis |
| `src/navigation` | Navegação |
| `src/context` | Gerenciamento de estado |
| `src/services` | Serviços e regras de negócio |
| `src/lib` | Configurações e integrações |
| `supabase` | Banco de dados e funções de servidor |
| `tests` | Testes automatizados |
| `docs` | Documentação técnica e acadêmica |

## Segurança e privacidade

O projeto utiliza autenticação, políticas de Row Level Security (RLS), armazenamento privado de imagens e mecanismos de gerenciamento de dados pessoais.

A exclusão de conta foi homologada em ambiente controlado e permanece desabilitada fora das janelas autorizadas de demonstração.

## Executando o projeto

Pré-requisitos: Node.js 24 e Development Build Android compatível.

```bash
npm ci
```

Configure as variáveis públicas do Supabase conforme o arquivo `.env.example` e as instruções do ambiente acadêmico.

```bash
node scripts/start-academic.cjs --check
node scripts/start-academic.cjs
```

A configuração acadêmica e o Development Build devem ser fornecidos separadamente pelo responsável.

## Testes

```bash
node --experimental-strip-types --test tests/*.test.cjs
```

A documentação da versão acadêmica registra 147 testes locais aprovados, além da homologação em dispositivo Android físico.

## Documentação e limitações

Os relatórios de implementação, validação, limitações técnicas e procedimentos de execução estão disponíveis no diretório `docs/`.

O projeto possui finalidade acadêmica, não representa uma integração oficial com órgãos públicos e ainda não está preparado para utilização comercial em produção.

## Licença

MIT.
