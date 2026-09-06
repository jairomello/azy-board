---
title: Criar e Editar Tasks e Bugs
type: guide
order: 2
---

# Criar e Editar Tasks e Bugs

Tasks representam atividades. Bugs representam defeitos. Os dois tipos compartilham a mesma janela operacional e podem ser convertidos entre si.

## Formas de criar

- Ação **Task** ou **Bug** na toolbar.
- Ação **Adicionar card** em uma coluna.
- Criação de subtask dentro de outro item.
- Criação por agente via API ou MCP.

## Abrir a edição

Selecione o corpo de um card. A janela apresenta o título no cabeçalho, campos de planejamento, descrição, subtasks, checklists, histórico e filhos.

## Organizar a modal

Os grupos de campos ficam em seções recolhíveis. A primeira seção começa aberta e as demais fechadas; use **Expandir tudo** ou **Recolher tudo** para ajustar a visualização. Recolher uma seção não descarta valores digitados, checklists, subtasks ou conteúdo rich text. O cabeçalho do checklist mostra o progresso concluído/total quando houver itens.

## Campos principais

| Campo | Finalidade |
|---|---|
| Título | Identificar claramente o trabalho. |
| Tipo | Alternar entre task e bug. |
| Status | Informar o estado geral. |
| Prioridade | Definir urgência e impacto. |
| Responsável | Atribuir uma pessoa ou deixar sem responsável. |
| Autor | Mostrar quem criou o item; somente leitura. |
| Pontos | Registrar estimativa. |
| Início e fim | Definir datas planejadas. |
| História pai | Posicionar o item na hierarquia. |
| Versão | Relacionar o item a uma entrega. |
| Centro de custo | Classificar financeiramente o trabalho. |
| Tags | Classificar e filtrar. |
| Descrição | Registrar contexto e instruções em rich text. |

Campos de versão e centro de custo aparecem quando o projeto possui opções cadastradas.

## Criar pela toolbar

1. Selecione **Task** ou **Bug**.
2. Edite o título inicial.
3. Escolha tipo, status, prioridade e responsável.
4. Defina história pai, versão e centro de custo quando aplicáveis.
5. Informe pontos e datas.
6. Acrescente tags e descrição.
7. Selecione **Salvar**.

## Criação rápida pela coluna

1. Selecione **Adicionar card** na coluna.
2. Informe o título.
3. Escolha task ou bug.
4. Confirme.

O item é criado na coluna escolhida, com prioridade média. Abra-o depois para completar os demais campos.

## Alterar o tipo

1. Abra o item.
2. No campo **Tipo**, escolha **Tarefa** ou **Bug**.
3. Salve.

O badge e a cor de tipo são atualizados. Épicos e histórias utilizam janelas próprias e não aparecem nesse seletor.

## Definir status e coluna

O status pode ser escolhido na modal. Também é atualizado ao mover o card para uma coluna com outro status base.

Estados disponíveis:

- Não iniciada.
- Em andamento.
- Bloqueada.
- Concluída.
- Cancelada.

## Definir prioridade

Use baixa, média, alta ou crítica. Prioridade não movimenta o card automaticamente e não altera permissões.

## Atribuir responsável

Escolha um membro do projeto ou **Não atribuído**. A atribuição indica quem executa, enquanto o autor registra quem criou.

Agentes podem reivindicar trabalho pelas integrações. Nesse caso, o card apresenta o responsável com identificação de IA.

## Vincular à hierarquia

O campo **História pai** apresenta histórias agrupadas por épico. Também permite criar rapidamente uma história.

Uma task ou bug pode ficar sem pai e aparecer em **Sem épico**.

## Pontos e datas

- Pontos: número inteiro igual ou maior que zero.
- Início: data planejada de começo.
- Fim: data planejada de conclusão.

As datas são informativas e não movem o card automaticamente.

## Versão e centro de custo

Selecione **Sem versão** ou **Nenhum** para remover associações. Em novas tasks e bugs, o primeiro centro de custo pode ser sugerido como padrão para manter a classificação do projeto.

## Descrição rich text

A descrição aceita conteúdo formatado para instruções, contexto, decisões e referências. Evite duplicar critérios de aceitação que pertencem à história.

## Salvar ou cancelar

- **Salvar** persiste campos e tags.
- **Cancelar** fecha sem confirmar.
- `Escape` retorna ao item pai em uma pilha ou fecha a modal atual.

## Regras e comportamentos

- Título é obrigatório para criação útil.
- Autor não pode ser trocado pela modal.
- Responsável precisa pertencer ao projeto.
- Versão e centro de custo precisam pertencer ao projeto.
- Alterar o pai atualiza breadcrumbs e agrupamento.
- Um item com filhos não pode ser movido manualmente.
- Mudanças relevantes alimentam o histórico automático.

## Permissões

`Admin` e `Membro` podem criar e editar. `Visualizador` pode consultar detalhes, autor, responsável e classificações.

## Funcionalidades relacionadas

- [[06 - Tasks Bugs e Subtasks/Organizar Subtasks e Navegar entre Filhos|Organizar subtasks e navegar entre filhos]]
- [[06 - Tasks Bugs e Subtasks/Tags|Tags]]
- [[06 - Tasks Bugs e Subtasks/Checklists|Checklists]]
- [[06 - Tasks Bugs e Subtasks/Historico de Atividades e Tempo Trabalhado|Histórico de atividades e tempo trabalhado]]

<details>
<summary><strong>Como funciona tecnicamente</strong></summary>

### Entidade unificada

Tasks e bugs são itens diferenciados pelo campo `type`. Campos operacionais são persistidos no mesmo registro, com relações opcionais para pai, coluna, responsável, versão e centro de custo.

### Salvamento

Campos são atualizados pela rota unificada de item. As tags são sincronizadas como uma relação muitos para muitos. Depois de mudanças hierárquicas, o frontend recarrega os itens para refletir ancestry paths e condição de folha.

### Auditoria

O serviço compara campos relevantes antes e depois da atualização e cria logs automáticos. Eventos de atualização mantêm outras sessões sincronizadas.

</details>
