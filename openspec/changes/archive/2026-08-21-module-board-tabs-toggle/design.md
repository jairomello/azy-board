## Context

O board já renderiza módulos como wrappers hierárquicos das swimlanes de Épico e persiste filtros por projeto em `localStorage`. A nova opção precisa oferecer uma alternativa de menor densidade visual sem duplicar a lógica de agrupamento, cards, drag-and-drop, filtros ou colapso já implementada.

## Goals / Non-Goals

**Goals:**

- Disponibilizar os modos `hierarchy` e `tabs` apenas quando a visualização ativa for o Board.
- Reutilizar os mesmos `moduleGroups` e a mesma renderização interna de épicos, histórias e colunas nos dois modos.
- Manter o módulo ativo controlado no `BoardPage`, com seleção inicial determinística e persistência compatível com os filtros do projeto.
- Fazer a troca de modo não perder filtros, cards, estado de colapso ou drag-and-drop.

**Non-Goals:**

- Não alterar API, banco, modelo de módulos ou endpoints.
- Não criar uma nova consulta por aba; todos os módulos continuam vindo do carregamento atual do board.
- Não remover o modo hierárquico atual, que continuará sendo o padrão.

## Decisions

- **Estado do modo:** adicionar `moduleViewMode: 'hierarchy' | 'tabs'` ao estado de filtros persistido. O padrão será `hierarchy` para preservar o comportamento atual.
- **Estado da aba ativa:** manter separado do filtro de módulo, usando o `moduleId` ativo e corrigindo-o quando o módulo deixar de existir ou for filtrado. Persistir a aba ativa por projeto é opcional, mas o modo escolhido deve ser persistido.
- **Local do controle:** colocar um seletor segmentado no painel de filtros/visualização existente, ao lado das opções de exibição de histórias, evitando criar uma nova área de controles.
- **Renderização:** extrair a renderização das swimlanes de módulo para uma função/componente compartilhado. No modo hierarquia, renderizar todos os `ModuleSwimlane`; no modo abas, renderizar somente o grupo correspondente à aba ativa.
- **Módulo sem módulo:** manter um grupo virtual `__no-module__`/`Sem módulo` como uma aba quando houver conteúdo, com label traduzido.
- **Responsividade:** permitir rolagem horizontal nas abas em telas estreitas e manter o conteúdo do board com a mesma rolagem existente.

Alternativa considerada: aplicar o filtro `moduleId` para simular abas. Foi rejeitada porque o filtro atual significa filtragem de dados e não fornece uma navegação clara entre módulos nem preserva a distinção entre preferência de visualização e recorte de conteúdo.

## Risks / Trade-offs

- **[Risk]** Dois estados relacionados (`moduleId` e aba ativa) podem divergir. **Mitigation:** no modo tabs, a aba ativa controla o grupo renderizado; o filtro de módulo continua sendo aplicado somente quando explicitamente selecionado e a aba é reajustada para um grupo válido.
- **[Risk]** Muitos módulos podem produzir uma barra de abas larga. **Mitigation:** usar overflow horizontal e tabs compactas com label truncado e tooltip.
- **[Risk]** Duplicação da lógica de swimlanes. **Mitigation:** compartilhar o renderer do conteúdo de módulo entre os modos.

## Migration Plan

1. Adicionar o novo valor ao estado default e ao carregamento tolerante de filtros antigos.
2. Implementar o controle e a renderização por abas.
3. Validar o comportamento antigo e o novo modo.
4. Nenhuma migração de banco ou rollback especial é necessária; remover o campo persistido faz o sistema voltar ao padrão hierárquico.

## Open Questions

- A aba ativa deve ser lembrada entre recarregamentos ou deve sempre iniciar no primeiro módulo? A implementação pode lembrar a última aba por projeto sem afetar a preferência do modo.
