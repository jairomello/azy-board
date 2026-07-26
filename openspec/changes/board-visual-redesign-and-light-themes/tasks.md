## 1. Modelo de dados e contrato compartilhado

- [x] 1.1 Adicionar `LightShellTheme` em `packages/types` com os valores `petroleum`, `ocean`, `emerald`, `graphite` e `classic`
- [x] 1.2 Adicionar `users.light_shell_theme` ao schema Drizzle, com default `petroleum`
- [x] 1.3 Gerar migração que preenche usuários existentes com `petroleum`
- [x] 1.4 Atualizar seed, setup e fixtures de teste

## 2. API de preferências

- [x] 2.1 Criar e registrar `usersRouter` protegido em `/api/users`
- [x] 2.2 Implementar `PATCH /api/users/me` com validação runtime dos três campos de preferência
- [x] 2.3 Garantir update por `userId + tenantId` e adicionar comentários `[TENANT]`
- [x] 2.4 Incluir `lightShellTheme` em login, `/auth/me` e resposta do update
- [ ] 2.5 Adicionar testes de sucesso, enum inválido, usuário não autenticado e isolamento cross-tenant

## 3. Bootstrap e tokens de tema

- [x] 3.1 Criar os tokens semânticos de canvas, superfícies, shell e status em `globals.css`
- [x] 3.2 Definir os cinco presets via `[data-light-shell-theme="..."]`
- [x] 3.3 Definir tokens escuros independentes dos presets claros
- [x] 3.4 Aplicar `theme` e `light-shell-theme` antes do primeiro render em `main.tsx`
- [x] 3.5 Implementar fallback para `petroleum` quando o valor persistido for ausente ou inválido
- [ ] 3.6 Adicionar testes contra flash de tema e restauração do preset após alternar claro/escuro

## 4. Estado de preferências no frontend

- [x] 4.1 Incluir `lightShellTheme` no usuário do `AuthContext`
- [x] 4.2 Criar `updatePreferences` centralizado usando `api.patch`
- [x] 4.3 Remover chamadas `fetch` diretas de `ThemeToggle` e `LanguageSelector`
- [x] 4.4 Sincronizar estado React, `<html>`, `localStorage` e servidor
- [ ] 4.5 Exibir feedback de sucesso/erro sem bloquear a troca visual imediata

## 5. Seção Aparência da conta

- [x] 5.1 Criar seção **Aparência** em `/account`, antes de API Keys
- [x] 5.2 Adicionar controle Claro/Escuro
- [x] 5.3 Criar seletor visual por swatches para Petróleo, Oceano, Esmeralda, Grafite e Clássico
- [x] 5.4 Implementar preview, check ativo, foco visível e navegação por teclado
- [x] 5.5 Adicionar traduções PT-BR, EN e ES
- [ ] 5.6 Testar persistência, reload, login em outro dispositivo e seleção enquanto o modo escuro está ativo

## 6. AppShell, sidebar e header

- [x] 6.1 Extrair `AppShell`, `WorkspaceSidebar` e `WorkspaceHeader`
- [x] 6.2 Renderizar apenas rotas e ações funcionais; não criar placeholders clicáveis
- [x] 6.3 Adicionar navegação para Projetos, Board/Árvore, Configurações e Conta
- [x] 6.4 Exibir projeto, sprint ativa, perfil, idioma, tema e estado de sincronização
- [x] 6.5 Substituir engrenagem literal por ícone Lucide e padronizar tooltips
- [x] 6.6 Implementar sidebar expandida, recolhida e drawer por breakpoint

## 7. Toolbar e contexto do Board

- [x] 7.1 Criar `BoardCommandBar` sem alterar a lógica existente dos filtros
- [x] 7.2 Consolidar filtros em painel/popover com contador e ação Limpar
- [x] 7.3 Manter Squad e Módulo como quick filters quando houver largura
- [x] 7.4 Criar menu **Criar** com Épico, História, Task e Bug
- [x] 7.5 Preservar criação contextual em cada coluna
- [x] 7.6 Implementar densidade `comfortable | compact` persistida localmente
- [x] 7.7 Criar busca client-side por ID e título ou omitir o campo até que seja funcional
- [x] 7.8 Criar contexto da sprint com total, concluídos e progresso

## 8. Swimlanes, colunas, cards e status rail

- [ ] 8.1 Extrair `SwimlaneHeader` e `KanbanColumn` de `BoardPage`
- [x] 8.2 Aplicar hierarquia visual, contagens, progresso e WIP quando disponível
- [x] 8.3 Refatorar `KanbanCard` com tokens, raio máximo de 8px e estados de hover/drag
- [x] 8.4 Preservar todos os metadados e ações atuais do card
- [x] 8.5 Criar `BoardStatusRail` com WebSocket e quantidade de itens visíveis
- [x] 8.6 Confirmar que drag and drop, Leaf Rule, Board/Árvore e modais não sofreram regressões

## 9. Modo escuro e responsividade

- [x] 9.1 Aplicar a proposta grafite do SVG escuro ao novo shell
- [x] 9.2 Garantir que presets claros não vazem para o modo escuro
- [ ] 9.3 Validar layout em 1600px, 1280px, 1024px, 768px e 390px
- [ ] 9.4 Validar títulos longos, muitas tags, colunas vazias e grande volume de cards
- [ ] 9.5 Validar zoom de 200% e `prefers-reduced-motion`

## 10. Qualidade e documentação

- [x] 10.1 Executar `bun run typecheck`
- [ ] 10.2 Executar testes unitários e de integração das preferências
- [ ] 10.3 Executar testes de fluxo do Board e da Conta
- [ ] 10.4 Verificar contraste WCAG AA para todos os presets
- [ ] 10.5 Capturar screenshots dos modos claro/escuro e dos cinco presets nos breakpoints definidos
- [x] 10.6 Atualizar a Wiki com as telas implementadas e diferenças em relação aos mockups

## 11. Hierarquia de histórias no Board

- [x] 11.1 Alterar o default para `storyDisplay = lanes`
- [x] 11.2 Renderizar lanes de STORY aninhadas em EPIC com accordions independentes
- [x] 11.3 Preservar histórias folha e agregadoras como cards no modo alternativo
- [x] 11.4 Adicionar `hideEmptyStories` somente no modo de lanes
- [x] 11.5 Persistir filtros e estados recolhidos de histórias por projeto
- [x] 11.6 Vincular criação contextual ao `parentId` da história
- [x] 11.7 Criar agrupamento `Sem história` para cards sem STORY ancestral
- [x] 11.8 Adicionar 10px de espaçamento entre header da coluna e primeiro card
- [x] 11.9 Atualizar Wiki, specs canônicas, proposal, design e delta spec
