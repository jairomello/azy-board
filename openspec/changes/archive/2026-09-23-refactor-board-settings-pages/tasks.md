## 1. Preparação e contratos

- [x] 1.1 Registrar o Board ref `2c14878f-dad2-4b4c-bc93-84e6f5d78436` nos módulos e preservar os contratos atuais de rota, i18n, API e WebSocket.
- [x] 1.2 Criar a estrutura `apps/web/src/features/board/` e `apps/web/src/features/project-settings/`, definindo tipos públicos e interfaces de entrada/saída das features.
- [x] 1.3 Criar testes de caracterização para troca de `projectId`, permissões, filtros persistidos e montagem das rotas antes de remover responsabilidades das páginas.

## 2. Extração da feature Board

- [x] 2.1 Extrair carregamento do projeto, itens, colunas e catálogos para hook/adaptador de dados do Board usando somente o cliente `api` existente.
- [x] 2.2 Extrair filtros, chips ativos, agrupamentos e preferências de visualização para módulo próprio, preservando chaves de `localStorage` e query params.
- [x] 2.3 Extrair colapso de módulos/épicos/stories e a composição das lanes para componentes da feature sem alterar a regra de cards folha.
- [x] 2.4 Extrair sincronização WebSocket, refresh de mutações do Azy Agent e estados de carregamento/erro para hooks da feature.
- [x] 2.5 Extrair drag-and-drop, ordenação e mutações de itens para módulo de interação com callbacks tipados e tratamento de erro equivalente.
- [x] 2.6 Extrair abertura e coordenação de ItemModal, StoryModal, EpicModal, criação de módulo e itens arquivados para componentes da feature.
- [x] 2.7 Criar `BoardScreen` como composição da feature e reduzir `BoardPage.tsx` ao adaptador de rota, removendo código duplicado.

## 3. Extração da feature Project Settings

- [x] 3.1 Criar o shell `ProjectSettingsScreen` com contexto de projeto, usuário atual, autorização e acordeões existentes.
- [x] 3.2 Extrair as seções de formato/visibilidade, planejamento e gerente com seus estados, carregamentos, salvamentos e mensagens traduzidas.
- [x] 3.3 Extrair as seções de colunas, membros/squads e centros de custo, preservando confirmações, permissões e atualização das listas.
- [x] 3.4 Extrair as seções de módulos, sprints e versões, preservando a visibilidade condicional para projetos `SIMPLE` e os modais existentes.
- [x] 3.5 Encapsular chamadas de Settings no cliente `api`, mantendo endpoints e payloads, e reduzir `SettingsPage.tsx` ao adaptador de rota.

## 4. Testes e contratos de comportamento

- [x] 4.1 Adicionar testes dos hooks/adaptadores do Board para carregamento, troca de projeto, eventos de refresh e filtros por projeto.
- [x] 4.2 Adicionar testes de interação do Board para drag-and-drop, abertura de modais, criação e tratamento de erro de mutação.
- [x] 4.3 Adicionar testes das seções de Settings para sucesso/erro de salvamento, isolamento de estado e restrição de usuário sem permissão.
- [x] 4.4 Ajustar testes de contrato que dependam dos arquivos monolíticos, mantendo assertions de texto somente para contratos explícitos.

## 5. Integração e verificação

- [x] 5.1 Remover imports, tipos, estados, efeitos e funções órfãos das páginas originais e confirmar que os shells não contêm regras de domínio das features.
- [x] 5.2 Verificar rotas existentes, i18n, query params, preferências por projeto, WebSocket, drag-and-drop e todas as seções de Settings em fluxo local.
- [x] 5.3 Executar `bun run check` e `bun run test:smoke`, corrigindo regressões de TypeScript, testes, build ou integração web/API.
- [x] 5.4 Validar que não foram adicionadas dependências externas, endpoints, payloads ou alterações de banco e registrar a conclusão no card do Azy Board.
