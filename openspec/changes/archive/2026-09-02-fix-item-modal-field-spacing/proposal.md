## Why

Na modal de edição de Task, os campos **História Pai** e **Tags** ficam visualmente colados aos campos anteriores, enquanto os demais grupos respeitam um espaçamento maior e consistente. Essa diferença prejudica a leitura da sequência do formulário e dá a impressão de que os campos pertencem a grupos diferentes.

## What Changes

- Padronizar o espaçamento vertical entre todos os grupos de label e campo das modais de item.
- Corrigir especificamente a separação entre Datas, História Pai e Tags.
- Manter a mesma distância entre label e seu controle e entre um grupo e o seguinte.
- Aplicar o ajuste a Tasks, Bugs e Subtasks, incluindo os estados de criação e edição.
- Preservar accordions, rich text, validações, payloads, responsividade e temas.
- Validar o resultado em desktop, mobile e com seções expandidas/recolhidas.

## Capabilities

### New Capabilities

- `consistent-item-modal-spacing`: hierarquia e espaçamento visual consistente nos formulários de itens.

### Modified Capabilities

- Nenhuma. O ajuste é visual e não altera requisitos de dados ou interação existentes.

## Impact

- `apps/web/src/components/ItemModal.tsx` e estilos compartilhados dos formulários.
- Testes de contrato visual/estrutural e validação responsiva.
- Nenhuma alteração de API, banco, payload ou dependência.
