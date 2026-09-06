## Why

Histórico e Filhos/Subtasks representam informações diferentes, mas atualmente aparecem próximos e podem ser interpretados como uma única seção da modal. Separá-los em accordions próprios melhora a compreensão, a navegação e o foco durante a edição de Tasks, Bugs e Subtasks.

## What Changes

- Manter um accordion exclusivo para **Histórico/Atividades**.
- Manter um accordion exclusivo para **Filhos/Subtasks**.
- Exibir títulos, ícones, resumos e conteúdo independentes.
- Permitir expandir/recolher cada seção separadamente e usar os controles globais existentes.
- Preservar logs, horas, criação/abertura de subtasks, salvamento, cancelamento e modais empilhadas.
- Não misturar progresso de filhos com histórico de atividades.
- Manter acessibilidade, responsividade, traduções e estado inicial dos accordions.

## Capabilities

### New Capabilities

- `separate-history-children-accordions`: separação visual e funcional dos accordions de histórico e filhos.

### Modified Capabilities

- `card-edit-ui`: a modal de item passa a apresentar Histórico e Filhos como seções independentes.

## Impact

- `apps/web/src/components/ItemModal.tsx` e componentes compartilhados de accordion.
- Traduções PT-BR/EN/ES e ícones/resumos da modal.
- Testes frontend de independência, estado inicial, expansão e modais filhas.
- Nenhuma alteração de API, banco ou payload.
