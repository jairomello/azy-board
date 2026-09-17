## Context

A `ItemModal` já possui a área `activity`, mas hoje ela mostra somente os botões `Histórico de alterações` e `Registrar trabalho`. Cada ação abre uma camada independente (`ActivityLogModal` ou `WorkLogModal`), o que deixa a área quase vazia e obriga o usuário a alternar contexto para ler ou cadastrar dados. Os componentes atuais já contêm os contratos de API, paginação de auditoria, edição/exclusão de diário, parsing de duração e regras de permissão que devem ser preservados.

Os recursos de backend são deliberadamente separados: `GET /audit` retorna eventos automáticos e `GET/POST/PATCH/DELETE /work-log` opera registros manuais. A solução deve aproveitar essa separação, integrar a apresentação na guia Histórico e não misturar dados, permissões ou totais.

## Goals / Non-Goals

**Goals:**

- Fazer a guia Histórico ser útil imediatamente, mesmo quando não houver registros.
- Mostrar auditoria automática e diário manual lado a lado em desktop, com cabeçalhos, contagens e estados próprios.
- Permitir criar, editar e excluir diário sem abrir uma segunda modal.
- Manter auditoria somente leitura, paginada e identificada por autor/origem.
- Atualizar listas, contagem da guia e total trabalhado após cada mutação.
- Manter foco, Escape, loading, erros, permissões e responsividade.
- Reutilizar a lógica testada de `ActivityLogModal` e `WorkLogModal` sem duplicar contratos de API.

**Non-Goals:**

- Alterar endpoints, payloads, schema, regras de autorização ou ordenação do backend.
- Misturar auditoria automática com registros manuais ou incluir duração nos eventos automáticos.
- Criar comentários, anexos, filtros avançados ou edição de eventos automáticos.
- Alterar as guias Detalhes, Subtasks e Checklists.
- Manter as submodais antigas como caminho alternativo dentro desta guia; a lógica pode ser extraída, mas o fluxo visível será inline.

## Decisions

### 1. Separar apresentação em dois painéis, mantendo dois domínios

A área `activity` renderizará `ActivityLogPanel` à esquerda e `WorkLogPanel` à direita. Cada painel terá título, contagem, loading, estado vazio, lista e mensagens de erro próprios. A contagem exibida na aba permanecerá a quantidade de eventos automáticos, enquanto o diário exibirá sua própria quantidade e o total de minutos.

Alternativa descartada: uma timeline única combinando eventos. Ela dificultaria distinguir atividade do sistema de tempo manual e violaria os contratos de separação.

### 2. Extrair lógica dos modais existentes

A lógica de fetch, normalização do texto de auditoria, paginação, parsing de duração, edição e exclusão deverá ser extraída para componentes/painéis compartilhados ou reutilizada diretamente com props de modo inline. `ActivityLogModal` e `WorkLogModal` podem ser removidos se não houver outros consumidores; não será criada uma segunda implementação de cada API.

Alternativa descartada: copiar o JSX dos modais para `ItemModal`. Isso duplicaria regras de permissão, mensagens e mutações e aumentaria o risco de divergência.

### 3. Carregamento independente e resiliente

Ao entrar na área Histórico, os dois painéis carregarão seus dados de forma independente. Uma falha de auditoria não esconderá o diário, e uma falha no diário não bloqueará a auditoria. Cada painel mostrará erro localizado e oferecerá retry ou continuará navegável.

O painel de auditoria manterá `page`, `total` e ação "Carregar mais". O diário manterá a lista atual, total de registros e total de duração, usando o limite já suportado pelo endpoint. Após mutação do diário, o painel recarregará sua lista e notificará `ItemModal` para atualizar `workLogCount` e `totalMinutes`.

### 4. Formulário de trabalho inline no painel direito

O diário exibirá uma ação clara para abrir o formulário dentro do próprio painel. O formulário terá descrição obrigatória, duração opcional em `H:MM`, salvar e cancelar. Edição substituirá o conteúdo do registro por controles inline e usará as mesmas condições `autor ou ADMIN` já aplicadas hoje. O autor não será selecionável.

Alternativa descartada: formulário sempre aberto ocupando o topo do painel. O estado vazio deve convidar ao primeiro lançamento, mas registros existentes precisam continuar visíveis sem uma área de entrada dominante.

### 5. Responsividade e acessibilidade

No desktop, usar `grid` de duas colunas com larguras equilibradas e alturas internas roláveis. Em viewports menores, empilhar Auditoria antes de Diário de trabalho; o formulário não poderá causar rolagem horizontal. Cada painel terá `aria-labelledby`, estados anunciáveis de erro e loading, botões com `type`, labels/aria-labels e foco devolvido ao controle que abriu ou cancelou o formulário.

### 6. Fechamento da guia e modais filhas

O Escape da `ItemModal` continuará fechando o nível superior. Como não haverá submodal para auditoria/diário, Escape durante edição de um registro deverá primeiro cancelar o editor/formulário local quando essa interação estiver ativa; caso contrário, fecha a `ItemModal`. A abertura de subtask e seus níveis continuará usando a stack existente.

## Risks / Trade-offs

- **[Duas listas aumentam a densidade visual]** → manter cabeçalhos fortes, contagens, cartões compactos e rolagem interna independente.
- **[Falha de uma API deixar um painel vazio indistinguível de ausência de dados]** → estados distintos de loading, vazio, erro e retry.
- **[Recarregar o diário após cada mutação causar perda de foco]** → manter o formulário fechado/aberto de forma controlada e devolver foco ao botão apropriado.
- **[Lista longa de auditoria ocupar muita altura]** → limitar painel, usar carregamento incremental e preservar `total`.
- **[Remoção das submodais afetar consumidores futuros]** → pesquisar referências antes de remover e manter componentes extraídos se ainda houver uso.
- **[Layout mobile ficar longo]** → empilhar painéis com títulos persistentes e ações visíveis, sem esconder o diário após a auditoria.

## Migration Plan

1. Criar/ajustar testes de contrato para a área integrada e inventariar consumidores dos dois modais.
2. Extrair ou adaptar a lógica de auditoria para um painel inline.
3. Extrair ou adaptar a lógica de diário para painel e formulário inline.
4. Integrar ambos em `ItemModal`, remover os gatilhos de submodal e preservar callbacks de contagem/total.
5. Atualizar i18n e validar desktop, mobile, acessibilidade e estados de erro.
6. Remover componentes modais somente se não houver consumidores restantes.
7. Executar `bun run check` e `bun run test:smoke`.
8. Rollback: restaurar os gatilhos para os modais existentes; não há migração de banco nem alteração de API.

## Open Questions

- O painel de auditoria deve mostrar inicialmente 20 eventos, como hoje, ou uma quantidade menor em mobile? A implementação pode manter 20 e usar o mesmo "Carregar mais" enquanto não houver evidência de impacto.
- O diário com mais de 100 registros precisará de paginação própria no futuro; esta mudança manterá o contrato atual e não inventará paginação sem suporte de API.
