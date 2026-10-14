# Design

## Context

Ver `proposal.md` (Why) para a motivação. Estado atual relevante:

- `ProjectPlanningModal` (`apps/web/src/components/ProjectPlanningModal.tsx`) mantém um
  `Draft` de strings + o `PlanningProject` carregado, deriva os campos divergentes em
  `planningPatch()` e grava por `PATCH /projects/:id` no rodapé Salvar/Cancelar.
- `ProjectsPage` renderiza o card com `p.description || t('common:defaultProjectDescription')`
  — a descrição é exibida como texto puro e truncada visualmente (`line-clamp-2`).
- A API valida projeto com `createProjectSchema`/`updateProjectSchema` **estritos**:
  `description` é `optionalText().optional()` (string até 20.000), portanto **`null` é
  rejeitado** e a remoção do texto se faz com string vazia.
- `ProjectPlanningFields` é compartilhado com a seção de Settings; a modal usa
  `saveMode="manual"`.
- A spec `project-planning-modal` **já contém** os requisitos de descrição (change
  `2026-10-14-descricao-do-projeto-na-modal-de-planejamento`, arquivada sem
  implementação): esta change implementa o que a spec já exige e acrescenta a
  distinção explícita entre Descrição e Escopo.

## Goals / Non-Goals

**Goals:**

- Um único lugar no produto para ler e manter a descrição do projeto, com a mesma
  semântica de gravação explícita já publicada.
- Reaproveitar 100% do contrato existente da API, sem tocar em rota, schema ou banco.
- Deixar claro na própria modal que a Descrição é o texto do card e o Escopo é o
  planejamento em texto rico.

**Non-Goals:**

- Descrição em texto rico, com editor Tiptap.
- Expor a descrição em Settings, no formulário de criação ou em `list_projects`.
- Migrar descrições vazias já gravadas para `null`.
- Alterar a renderização do card em `ProjectsPage`.

## Decisions

**1. Campo próprio na modal, e não em `ProjectPlanningFields`.**
O componente compartilhado serve a seção de Settings, que não deve ganhar descrição
nesta change. O campo entra direto na aba de planejamento da modal, em `<textarea>`
logo abaixo do nome — a descrição é o resumo que o card exibe, então ler/editar junto
do nome é o lugar previsível. `id="project-planning-description"`, `maxLength={20_000}`.
*Alternativa:* colocar no componente compartilhado — descartada por arrastar Settings
junto sem pedido.

**2. Texto simples, sem Markdown nem HTML.**
O card renderiza a descrição como texto puro; oferecer editor rico criaria divergência
entre o que se digita e o que se lê.
*Alternativa:* reusar o `RichTextEditor` do escopo — descartada; o card não renderiza
HTML e o dado mudaria de formato.

**3. Limpar a descrição grava string vazia, nunca `null`.**
O schema estrito da API rejeita `null` em `description`; `''` é aceito, o card cai no
fallback `defaultProjectDescription` e a modal reabre com o campo vazio. O efeito
visual é o desejado sem qualquer mudança de contrato.
*Trade-off:* o banco fica com `''` em vez de `null` para projetos que tiveram a
descrição limpa — invisível para o produto. *Alternativa:* tornar a coluna nullable no
schema da API — mudança de contrato fora do escopo.

**4. Trim na comparação e na gravação.**
`planningPatch()` compara `draft.description.trim()` com `project.description ?? ''` e
envia o valor aparado; logo, só espaços equivale a vazio. Segue o que já é feito com o
nome do projeto.
*Alternativa:* enviar cru — descartada; um texto só com espaços gravaria "vazio sujo" e
o card exibiria uma linha em branco no lugar do fallback.

**5. Delta com MODIFIED pontual + ADDED da distinção.**
A mudança anterior na mesma capability já está arquivada e sincronizada, então não há
mais risco de sobrescrita: o requisito "Campo de descrição do projeto na modal" é
reescrito apenas para fixar a posição do campo logo abaixo do nome, e o requisito novo
"Distinção entre a Descrição e o Escopo" cobre a ajuda de preenchimento e os rótulos.
O restante do texto do requisito é preservado integralmente.
*Alternativa:* só ADDED, deixando a posição como detalhe de implementação —
descartada; a posição é o que responde diretamente à confusão relatada ("não sei de
onde vem o texto").

**6. Modo leitura reaproveita o padrão do escopo.**
MEMBER/VIEWER veem a descrição como texto; quando vazia, o mesmo traço "—" usado pelo
escopo, mantendo a leitura previsível sem controles de edição.

**7. Chaves de tradução em `common`.**
O rótulo do nome do projeto já vive em `common:projectName` e é o campo imediatamente
acima; as chaves novas (`projectDescription`, `projectDescriptionPlaceholder`) ficam ao
lado dele, nos três idiomas, para a paridade exigida por `bun run check:i18n`.

## Risks / Trade-offs

- **Divergência entre o card truncado e a descrição longa** → o limite de 20.000 é o da
  API; o card já trunca visualmente e nada muda nesse comportamento.
- **Usuário esperar Markdown porque "Escopo" tem editor rico ao lado** → mitigado pela
  ajuda de preenchimento do campo e pelo requisito "Distinção entre a Descrição e o
  Escopo".
- **`description` com `''` vindo de projetos antigos** → tratado como vazio na
  comparação (`?? ''`), sem efeito no card.
- **Texto longo em `<textarea>` dentro de modal de altura fixa** → o conteúdo da aba já
  rola (`overflow-y-auto`) e o campo não muda a altura do diálogo.

## Migration Plan

Não há migração de dados nem de schema: o campo já existe, já é aceito pela API e só
ganha superfície na interface. Rollback = reverter o commit do web; nenhum dado novo
fica órfão.
