## 1. Fundação visual e dependência

- [x] 1.1 Adicionar `recharts` ao frontend e validar licença MIT no lockfile.
- [x] 1.2 Definir tokens de cores semânticas, tipografia, espaçamento, estados e séries para temas claro/escuro.
- [x] 1.3 Criar adapters tipados que transformem os contratos atuais em dados de gráficos sem recalcular regras de negócio.
- [x] 1.4 Criar componentes reutilizáveis `DashboardCard`, `MetricValue`, `ChartLegend`, `ChartTooltip`, `ChartSkeleton` e `ChartEmptyState`.

## 2. Cards e visualizações

- [x] 2.1 Redesenhar o grid responsivo e o cabeçalho dos dez cards, preservando filtros e estados existentes.
- [x] 2.2 Implementar Progresso e Escopo com donut, barras de quantidade/pontos e cobertura de estimativa.
- [x] 2.3 Implementar WIP com barras por status e lista compacta de itens.
- [x] 2.4 Implementar Bloqueados e Atrasados com distribuição visual por faixa/squad e detalhes objetivos.
- [x] 2.5 Implementar Burnup com área temporal, tooltip, linha de cobertura, seletor de quantidade/pontos e tabela equivalente.
- [x] 2.6 Implementar Aging WIP com histograma de faixas, mediana, maior idade e indicação de idade mínima conhecida.
- [x] 2.7 Implementar Sprint com comparação visual de compromisso, concluído, escopo atual e não concluído por ciclo.
- [x] 2.8 Implementar Versões com barras de progresso por quantidade e pontos, incluindo versões vazias.
- [x] 2.9 Implementar Carga da Equipe com barras de WIP/bloqueados, itens sem responsável e sem ranking.
- [x] 2.10 Implementar Horas Registradas com barras temporais e alternância por autor/squad quando disponível.

## 3. Interação e acessibilidade

- [x] 3.1 Adicionar tooltips, legendas, unidades, hover/foco e tabelas ou descrições equivalentes em todos os gráficos.
- [x] 3.2 Adicionar drill-down para Board e detalhes de itens sem alterar isolamento, RBAC ou filtros de forma surpreendente.
- [x] 3.3 Implementar skeletons específicos, empty states explicativos, erros recuperáveis, cobertura parcial e filtros inaplicáveis.
- [x] 3.4 Garantir teclado, ARIA, foco visível, contraste, distinção semântica sem depender apenas de cor e `prefers-reduced-motion`.
- [x] 3.5 Validar layout em desktop, tablet e mobile sem rolagem horizontal da página.

## 4. Dados e qualidade

- [x] 4.1 Verificar se os contratos atuais suportam todas as séries; adicionar somente campos agregados estritamente necessários e compatíveis.
- [x] 4.2 Cobrir fixtures com dados normais, vazios, parciais, muitos itens, zero bloqueios e versões/sprints sem itens.
- [x] 4.3 Criar testes frontend para os dez gráficos, estados, tooltips, filtros, drill-down e ausência de métricas excluídas.
- [x] 4.4 Criar testes de acessibilidade e responsividade dos cards, incluindo tema escuro e navegação por teclado.
- [x] 4.5 Medir bundle e performance, evitando imports desnecessários e animações custosas em séries grandes.

## 5. Documentação e validação

- [x] 5.1 Atualizar protótipo visual e documentação funcional do Dashboard com as novas visualizações.
- [x] 5.2 Documentar semântica de cores, gráficos, cobertura parcial, horas registradas e limites de interpretação.
- [x] 5.3 Executar typecheck, lint, testes, build e auditoria de licença da dependência.
- [x] 5.4 Revisar visualmente a tela contra o protótipo e registrar a validação final.

## Follow-up deste recorte

- [x] Substituir Progresso e Escopo por gauges de quantidade e pontos, com cobertura legível.
- [x] Substituir WIP por donuts de quantidade e pontos para as quatro categorias da população Leaf filtrada.
- [x] Adicionar ranking top-10 de Bloqueados/Aging e modais acessíveis com abertura no Board.
- [x] Substituir Atrasados por big number e donuts comparativos; remover tabela/listas compactas do recorte.
- [x] Manter Burnup somente como gráfico com tooltip, legenda e cobertura.
- [x] Adicionar agregados compatíveis e testes de distribuição, limite top-10 e pontos nulos.

## Follow-up: drill-down por fatia de Atrasados

- [x] Tornar individualmente clicáveis as fatias de quantidade e pontos, abrindo somente os itens da fatia selecionada.
- [x] Incluir detalhes mínimos dos itens restantes no snapshot, mantendo filtros, tenant e RBAC.
- [x] Cobrir separação de atrasados/restantes e contrato de interação da modal.

## Follow-up: recorte atual do Dashboard

- [x] Remover Sprint e Versões da composição visual e os fetches exclusivos da página.
- [x] Exibir Carga da Equipe somente como quantidade por pessoa, com toggle acessível de itens/pontos e cobertura de pontos.
- [x] Exibir Horas Registradas como total geral e donut agregado por autor do log.
- [x] Atualizar contratos, testes, i18n e documentação para a nova semântica sem incluir bloqueados ou ranking.

## Follow-up: descrições dos cards e rótulos do WIP

- [x] Adicionar uma descrição traduzida no rodapé dos oito cards atuais.
- [x] Identificar explicitamente os donuts WIP por quantidade de itens e por pontos nos três idiomas.
- [x] Cobrir as descrições e os rótulos distintos do WIP nos testes frontend.
