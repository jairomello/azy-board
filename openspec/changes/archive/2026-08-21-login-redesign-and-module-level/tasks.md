## 1. Redesenho da LoginPage

- [x] 1.1 Alterar o padding do painel direito da LoginPage (`<section>` do formulário) de `lg:p-16` para `lg:py-20 lg:px-12`, mantendo `px-5 py-10` no mobile e `sm:p-12` no tablet
- [x] 1.2 Adicionar `div` absoluta de fundo no card externo da LoginPage, preparada para receber `background-image` no futuro (sem imagem aplicada agora), com classes `absolute inset-0 bg-cover bg-center pointer-events-none`
- [x] 1.3 Garantir que o formulário de login não estique verticalmente — verificar que o `flex items-center justify-center` do painel direito centraliza o conteúdo compacto sem forçar altura mínima
- [x] 1.4 Testar responsividade: verificar que o layout não causa overflow em telas mobile, tablet e desktop

## 2. Componente ModuleSwimlane

- [x] 2.1 Criar novo componente `apps/web/src/components/ModuleSwimlane.tsx` com: header collapsível (nome do módulo + contagem de épicos), área de conteúdo para as swimlanes de Épico filhas, estado de colapso controlado via props
- [x] 2.2 Adicionar estilo visual distinto para o header da ModuleSwimlane — mais neutro/sutil que o header de Épico, com ícone de módulo (ex.: `Package` do lucide-react)
- [x] 2.3 Implementar persistência do estado de colapso por módulo (usar `Set<string>` no estado do BoardPage, similar a `collapsedEpics`)

## 3. Agrupamento por Módulo no BoardPage

- [x] 3.1 No `BoardPage.tsx`, criar `moduleGroups` a partir de `epicGroups` — agrupar épicos por `moduleId` usando `useMemo`
- [x] 3.2 Módulos sem épicos devem ser excluídos do `moduleGroups` (não renderizar ModuleSwimlane vazia)
- [x] 3.3 Épicos sem `moduleId` devem ser agrupados em um módulo virtual "Sem módulo"
- [x] 3.4 Ordenar `moduleGroups` pela posição do módulo (campo `position`)
- [x] 3.5 Substituir a renderização direta de `epicGroups` no JSX por `moduleGroups` envolvendo `ModuleSwimlane` → `Swimlane` (Épico) → `StorySwimlane` → `BoardColumns`
- [x] 3.6 Atualizar `orphanCards` para considerar cards sem épico E sem módulo

## 4. Botão "+ Módulo" no Toolbar

- [x] 4.1 Adicionar opção "Módulo" no dropdown de criação do `BoardCommandBar.tsx` — primeiro item da lista, com ícone `Package` do lucide-react e cor distinta
- [x] 4.2 Atualizar tipo do `onCreate` callback para suportar criação de módulo (adicionar tipo `'MODULE'` ou criar callback separado `onCreateModule`)
- [x] 4.3 No `BoardPage.tsx`, handler de criação de módulo deve abrir uma modal simples de criação (nome + descrição opcional)
- [x] 4.4 Criar modal de criação de módulo (pode reutilizar padrão de modal existente) com chamada a `POST /projects/:id/modules`
- [x] 4.5 Após criação do módulo, atualizar lista de módulos no board via websocket ou refetch

## 5. i18n — Novas chaves de tradução

- [x] 5.1 Adicionar chaves de tradução PT-BR, EN, ES para: label do botão "+ Módulo", placeholder de nome/descrição do módulo, header da ModuleSwimlane ("X módulos", "Y épicos"), módulo "Sem módulo"
- [x] 5.2 Arquivos: `apps/web/src/i18n/locales/pt-BR/board.json`, `en/board.json`, `es/board.json`

## 6. Atualização do Breadcrumb

- [x] 6.1 Verificar que o `ancestryPath` já inclui o módulo no caminho — se não, ajustar a lógica de construção do breadcrumb no backend/frontend para incluir `Módulo > Épico > História > Task`
- [x] 6.2 Atualizar exibição do breadcrumb no `KanbanCard.tsx` para mostrar o módulo como primeiro nível do caminho

## 7. Progresso agregado no Módulo

- [x] 7.1 Calcular progresso agregado do módulo no header da ModuleSwimlane (soma de progresso de todos os épicos do módulo)
- [x] 7.2 Exibir barra de progresso e porcentagem no header da ModuleSwimlane
- [x] 7.3 Calcular pontuação total do módulo (soma de pontos de todas as tasks folha descendentes) e exibir no header

## 8. Testes e validação

- [x] 8.1 Verificar que TypeScript compila sem erros (`bun run typecheck` ou equivalente)
- [ ] 8.2 Testar fluxo completo: criar módulo → criar épico no módulo → criar história → criar task → verificar hierarquia visual no board
- [ ] 8.3 Testar colapso/expansão de ModuleSwimlane e persistência do estado
- [ ] 8.4 Testar responsividade da LoginPage em mobile, tablet e desktop
- [ ] 8.5 Testar criação de módulo pela toolbar e verificação de que aparece no board
