## ADDED Requirements

### Requirement: Dashboard por projeto
O sistema SHALL oferecer uma página `/projects/:projectId/dashboard` com os oito quadros Progresso e Escopo, WIP, Bloqueados, Atrasados, Burnup, Aging WIP, Carga da Equipe e Horas Registradas. Sprint e Versões não são renderizados. Além dos dados e listas objetivos existentes, a página SHALL apresentar gráficos adequados, estados visuais completos, tooltips, legendas, tabelas equivalentes e drill-down, mantendo filtros, cobertura parcial, Leaf Rule, RBAC e isolamento por tenant.

#### Scenario: Acesso autorizado
- **WHEN** usuário com papel VIEWER, MEMBER ou ADMIN acessa o Dashboard de projeto ao qual pertence
- **THEN** sistema exibe os oito quadros com dados atuais ou estados explícitos de loading, vazio, erro, parcial ou filtro inaplicável

#### Scenario: Acesso não autorizado
- **WHEN** usuário tenta acessar o Dashboard de projeto sem membership ou de outro tenant
- **THEN** sistema retorna a mesma resposta de recurso não encontrado/autorização usada pelas rotas protegidas e não renderiza dados

#### Scenario: Dados suficientes para gráficos
- **WHEN** um ou mais quadros têm dados agregados
- **THEN** cada quadro aplicável mostra métrica principal, gráfico, legenda/unidade e detalhe textual equivalente, preservando o significado dos dados

#### Scenario: Filtros preservados
- **WHEN** usuário aplica período, módulo, sprint, versão, squad, responsável ou tipo
- **THEN** cada quadro usa somente filtros aplicáveis declarados na resposta e o estado visual identifica filtros inaplicáveis

#### Scenario: Responsividade e acessibilidade
- **WHEN** Dashboard é usado em mobile, teclado ou tema escuro
- **THEN** cards permanecem utilizáveis, os gráficos têm descrição/tabela equivalente, foco visível e informação não dependente exclusivamente de cor

#### Scenario: Escopo excluído
- **WHEN** usuário consulta qualquer estado do Dashboard
- **THEN** interface não exibe finanças, recomendações de IA, capacidade configurável, WIP limit, P85, CFD, throughput, lead/cycle time ou ranking de produtividade
