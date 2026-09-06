## Why

O Dashboard atual entrega os dados corretos, mas a leitura é pobre: quase todos os cards mostram números e listas, enquanto o protótipo e o uso gerencial pedem percepção visual rápida. Esta melhoria transforma os dez quadros existentes em uma experiência gráfica, colorida, responsiva e profissional sem adicionar métricas de negócio, campos obrigatórios ou ranking de pessoas.

## What Changes

- Adicionar a dependência gratuita e permissiva `recharts` ao frontend.
- Redesenhar os dez cards com hierarquia visual consistente, cores semânticas, estados e espaçamento alinhados ao protótipo.
- Adicionar gráficos SVG responsivos para progresso, WIP, bloqueios, atrasos, burnup, aging, sprint, versões, carga da equipe e horas.
- Adicionar tooltips, legendas, métricas de apoio, alternância quantidade/pontos quando aplicável e drill-down para o Board.
- Manter tabelas ou descrições equivalentes para acessibilidade e leitura sem depender de cor.
- Melhorar skeletons, empty states, cobertura parcial, erro e atualização/reconexão.
- Preservar os contratos e filtros existentes; mudanças de API somente se necessárias para dados gráficos agregados e tipados.
- Não adicionar finanças, IA, capacidade configurável, WIP limit, P85, CFD, throughput, lead/cycle time ou ranking de produtividade.

## Capabilities

### New Capabilities

- `project-dashboard-visualizations`: visualizações gráficas, composição visual, interações e estados dos dez cards do Dashboard.

### Modified Capabilities

- `project-dashboard`: o Dashboard existente passa a oferecer visualizações gráficas, drill-down e apresentação visual enriquecida mantendo seus dados e filtros.

## Impact

- `apps/web`: página, componentes de cards/gráficos, estilos, tokens de cor, tipos/adapters e testes.
- `packages/types`: contratos para séries, tooltips, estados e detalhamentos gráficos, se necessário.
- `apps/api`: somente agregações ou campos adicionais comprovadamente necessários; contratos existentes devem permanecer compatíveis.
- `package.json`/lockfile: nova dependência `recharts`, sob licença MIT.
- Documentação funcional e visual do Dashboard.
