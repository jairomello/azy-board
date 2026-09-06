## Context

`ItemModal` já organiza campos, descrição, subtasks, checklists e atividade em accordions. A atividade contém histórico e horas; a seção de subtasks contém filhos diretos e criação/navegação. A separação deve ser estrutural e não duplicar dados ou chamadas existentes.

## Goals / Non-Goals

**Goals:**

- Diferenciar claramente auditoria/atividade de estrutura hierárquica.
- Permitir controle independente e manter resumos específicos.
- Preservar a pilha de modais ao abrir um filho.

**Non-Goals:**

- Alterar endpoint, formato de logs, regras de filhos ou progresso.
- Criar novo tipo de item ou persistir estado de expansão.

## Decisions

- Usar dois IDs estáveis, `item-activity` e `item-children`, no mesmo `Set` controlado já usado pela modal.
- O accordion de Histórico exibirá resumo de horas/atividades quando disponível.
- O accordion de Filhos exibirá contagem de filhos e ações existentes, sem mostrar logs.
- Cada seção terá título e ícone próprios, `aria-controls` independente e foco preservado.
- Os controles Expandir tudo/Recolher tudo continuarão operando sobre ambas as seções.

## Risks / Trade-offs

- **Usuário pode confundir atividade e filhos** → títulos, ícones e resumos explicitamente distintos.
- **Mais uma seção aumenta a altura da lista de headers** → manter headers compactos e fechados por padrão, exceto a primeira seção.
- **Abertura de filho pode perder contexto** → reutilizar o mecanismo de stack e retorno existente.

## Migration Plan

1. Separar os blocos JSX e os IDs dos accordions.
2. Ajustar resumos e traduções.
3. Testar expansão independente, controles globais e abertura de filho.
4. Nenhuma migração de dados é necessária.

## Open Questions

Nenhuma questão bloqueante.
