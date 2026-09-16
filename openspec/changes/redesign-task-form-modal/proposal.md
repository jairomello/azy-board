## Why

O formulário atual concentra criação e edição em um fluxo vertical estreito, com campos operacionais, descrição rica e recursos relacionados misturados. Isso aumenta a rolagem, dificulta localizar propriedades importantes e não aproveita o espaço horizontal disponível no board. O protótipo `docs/mockups/task-form-01-modal-ampla.png` oferece uma hierarquia mais clara e é o melhor equilíbrio entre densidade, compatibilidade com o sistema atual e acesso aos recursos existentes.

## What Changes

- Substituir o layout estreito de `ItemModal` por um modal amplo, responsivo e dividido em área principal de conteúdo e painel de propriedades.
- Organizar a tela em abas/áreas de Detalhes, Subtasks, Checklists e Histórico, preservando os recursos já existentes.
- Manter título, tipo, status, responsável, prioridade, sprint, versão, pontos, datas, código, autor, história pai, tags e descrição sem alterar seus significados ou payloads.
- Exibir resumos e contagens de subtasks, checklists e histórico nas áreas de navegação.
- Preservar edição rica, modais empilhadas de subtasks, logs de trabalho, cancelamento, Escape, salvamento e atualização em tempo real.
- Adaptar o modal para telas pequenas sem exigir rolagem horizontal e com ações de salvar/cancelar sempre acessíveis.
- Atualizar contratos de acessibilidade e traduções PT-BR, EN e ES relacionados ao novo layout.

## Capabilities

### New Capabilities

Nenhuma. A mudança reorganiza uma capacidade existente e não introduz um novo domínio funcional.

### Modified Capabilities

- `card-creation-ui`: criação de TASK/BUG pela toolbar passa a usar o novo modal amplo, com os mesmos campos padrão e regras de confirmação/cancelamento.
- `card-management`: visualização e edição de cards passam a oferecer a nova navegação por áreas, painel de propriedades, estados responsivos e preservação dos recursos relacionados.

## Impact

- Frontend: `ItemModal`, `BoardPage`, componentes de criação/seleção, componentes de accordion, editores ricos e testes de contrato visual/comportamental.
- Internacionalização: chaves das namespaces `board` e `common` nos três idiomas suportados.
- API/backend: sem mudança de endpoint ou modelo prevista; os payloads existentes de criação e atualização devem continuar sendo usados.
- Acessibilidade: foco, `aria-*`, navegação por teclado, Escape, leitura de abas/seções e contraste.
- Responsividade: modal desktop amplo semelhante ao protótipo e composição empilhada em viewport móvel.
- Dependências: nenhuma dependência nova; reutilizar Tailwind, Lucide, Tiptap e componentes existentes.
