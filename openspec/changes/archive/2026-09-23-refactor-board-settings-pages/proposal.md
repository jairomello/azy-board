## Why

`BoardPage.tsx` (2.007 linhas) e `SettingsPage.tsx` (1.511 linhas) concentram estado, carregamento, efeitos, regras de interação e renderização de muitas áreas independentes. Essa concentração torna mudanças arriscadas, dificulta testes comportamentais e aumenta a chance de regressões em filtros, sincronização em tempo real, drag-and-drop, modais e configurações do projeto.

A mudança é necessária agora para criar fronteiras de domínio no frontend antes de novas funcionalidades ampliarem ainda mais essas páginas. A refatoração deve ser evolutiva, sem reescrever o produto nem alterar contratos da API ou o comportamento percebido pelo usuário.

## What Changes

- Extrair o Board para uma feature modular com shell de página, componentes de apresentação, hooks de carregamento/sincronização e módulos de estado por responsabilidade.
- Separar o estado e a lógica do Board em áreas explícitas: contexto do projeto e catálogos, filtros e agrupamentos, tempo real, drag-and-drop/movimentação, mutações, árvore e modais.
- Extrair o Settings para uma feature modular com um componente e estado próprios para cada seção: formato/visibilidade, planejamento, colunas, gerente, membros e squads, centros de custo, módulos, sprints e versões.
- Manter `BoardPage` e `SettingsPage` como adaptadores finos de rota, preservando URLs, permissões, i18n, contratos da API, eventos WebSocket e navegação.
- Padronizar a passagem de `projectId`, estado de carregamento/erro e callbacks entre os novos módulos sem introduzir uma camada de cache nesta change.
- Adicionar testes comportamentais dos hooks e componentes extraídos, mantendo testes de contrato apenas onde houver um contrato textual ou estrutural explícito.
- Migrar incrementalmente, removendo responsabilidades da página somente após o novo módulo estar coberto e integrado.

## Capabilities

### New Capabilities

- `frontend-page-modularity`: define fronteiras modulares para as telas Board e configurações do projeto, com preservação de comportamento e contratos durante a extração.

### Modified Capabilities

- Nenhuma capability existente terá requisitos funcionais alterados; esta change reorganiza a implementação e adiciona testes sem mudar o comportamento do produto.

## Impact

- **Board:** `apps/web/src/pages/BoardPage.tsx`, componentes de board, hooks de WebSocket e utilitários de filtros/agrupamento.
- **Settings:** `apps/web/src/pages/SettingsPage.tsx`, componentes de acordeão e componentes de cada seção de configuração.
- **Testes:** novos testes de componentes/hooks e ajustes dos contratos que atualmente dependem da estrutura das páginas.
- **Contratos preservados:** API REST, WebSocket, permissões, rotas, query params, traduções e estados do board por projeto.
- **Dependências:** nenhuma dependência externa nova é necessária; a solução usa React, hooks e utilitários já existentes.
- **Rastreabilidade:** Board ref: `2c14878f-dad2-4b4c-bc93-84e6f5d78436`.
