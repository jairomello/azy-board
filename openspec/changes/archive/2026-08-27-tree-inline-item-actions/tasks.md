## 1. Mapear os fluxos existentes

- [x] 1.1 Identificar os componentes da Tree View, da linha hierárquica e das ações/estado de expansão.
- [x] 1.2 Identificar os modais de criação por tipo, a `ItemModal`, os hooks de mutação e a consulta da árvore.
- [x] 1.3 Confirmar como permissões, filtros, eventos realtime e atualização de progresso são aplicados no frontend.

## 2. Implementar ações de criação

- [x] 2.1 Adicionar à Tree View os botões visíveis de Módulo, Épico, História, Task e Bug usando os componentes de ação existentes.
- [x] 2.2 Implementar ações contextuais na linha selecionada, habilitando somente os tipos válidos para o pai atual.
- [x] 2.3 Passar `parentId` e `moduleId` corretos aos modais de criação e preservar os comportamentos de validação existentes.
- [x] 2.4 Ocultar ou desabilitar ações de criação para usuários VIEWER e garantir feedback de erro para falhas da API.

## 3. Implementar edição pela linha

- [x] 3.1 Adicionar botão de editar acessível em cada linha editável e impedir propagação para expansão ou seleção.
- [x] 3.2 Conectar o botão à modal completa de edição correspondente, carregando os dados atuais do item.
- [x] 3.3 Atualizar a linha e os agregadores ancestrais após salvar, mantendo cancelamento sem persistência.
- [x] 3.4 Ocultar ou desabilitar edição para usuários VIEWER e preservar a autorização server-side do CRUD unificado.

## 4. Sincronização e estado da árvore

- [x] 4.1 Invalidar ou refazer a consulta da árvore após criação e edição bem-sucedidas.
- [x] 4.2 Preservar filtros e nós expandidos durante a atualização quando os itens ainda existirem.
- [x] 4.3 Garantir compatibilidade com a sincronização realtime e recalcular progresso e pontos afetados.

## 5. Testes e validação

- [x] 5.1 Criar testes de renderização e interação para ações gerais e contextuais de criação por tipo.
- [x] 5.2 Criar testes para preenchimento de pai/módulo e bloqueio de tipos incompatíveis.
- [x] 5.3 Criar testes para abertura, salvamento, cancelamento e isolamento do botão de edição por linha.
- [x] 5.4 Criar testes de permissões, erro de API, preservação de filtros/expansão e atualização dos agregadores.
- [x] 5.5 Executar a suíte de testes e a verificação de TypeScript em modo strict, corrigindo eventuais falhas.
