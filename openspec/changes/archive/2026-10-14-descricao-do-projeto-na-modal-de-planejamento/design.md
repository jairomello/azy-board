# Design

## Context

Ver `proposal.md` para a motivação. Estado atual relevante:

- `ProjectPlanningModal` mantém um `Draft` de strings + o `PlanningProject` carregado, deriva os campos divergentes em `planningPatch()` e grava por `PATCH /projects/:id` no rodapé Salvar/Cancelar (ver a change `botao-salvar-no-modal-de-planejamento`, ainda não arquivada).
- `ProjectsPage` renderiza o card com `p.description || t('common:defaultProjectDescription')` — a descrição é exibida como texto puro e truncada visualmente.
- A API valida projeto com `createProjectSchema`/`updateProjectSchema` **estritos**: `description` é `optionalText().optional()` (string até 20.000), portanto **`null` é rejeitado** e a remoção do texto se faz com string vazia.
- `ProjectPlanningFields` é compartilhado com a seção de Settings; a modal usa `saveMode="manual"`.

## Goals / Non-Goals

**Goals:**

- Um único lugar no produto para ler e manter a descrição do projeto, com a mesma semântica de gravação explícita já publicada.
- Reaproveitar 100% do contrato existente da API, sem tocar em rota, schema ou banco.

**Non-Goals:**

- Descrição em texto rico, com editor Tiptap.
- Expor a descrição em Settings, no formulário de criação ou em `list_projects`.
- Migrar descrições vazias já gravadas como string vazia para `null`.

## Decisions

**1. Campo próprio na modal, e não em `ProjectPlanningFields`.**
O componente compartilhado serve a seção de Settings, que não deve ganhar descrição nesta change. O campo entra direto na aba de planejamento da modal, em `<textarea rows={3}>` logo abaixo do nome — a descrição é o resumo que o card exibe, então ler/editar junto do nome é o lugar previsível. `id="project-planning-description"`, `maxLength={20_000}`.
*Alternativa:* colocar no componente compartilhado — descartada por arrastar Settings junto sem pedido.

**2. Texto simples, sem Markdown nem HTML.**
O card renderiza a descrição como texto puro; oferecer editor rico criaria divergência entre o que se digita e o que se lê.
*Alternativa:* reusar o `RichTextEditor` do escopo — descartada; o card não renderiza HTML e o dado mudaria de formato.

**3. Limpar a descrição grava string vazia, nunca `null`.**
O schema estrito da API rejeita `null` em `description`; `''` é aceito, o card cai no fallback `defaultProjectDescription` e a modal reabre com o campo vazio. O efeito visual é o desejado sem qualquer mudança de contrato.
*Trade-off:* o banco fica com `''` em vez de `null` para projetos que tiveram a descrição limpa — invisível para o produto. *Alternativa:* tornar a coluna nullable no schema da API — mudança de contrato fora do escopo.

**4. Trim na comparação e na gravação.**
`planningPatch()` compara `draft.description.trim()` com `project.description ?? ''` e envia o valor aparado; logo, só espaços equivale a vazio. Segue o que já é feito com o nome do projeto.
*Alternativa:* enviar cru — descartada; um texto só com espaços gravaria "vazio sujo" e o card exibiria uma linha em branco no lugar do fallback.

**5. Delta só de adição, para não colidir com a change aberta.**
A change anterior já modifica "Campos de planejamento na modal" na mesma capability. Um MODIFIED escrito aqui seria aplicado depois e sobrescreveria a gravação explícita no arquivamento. O requisito existente continua verdadeiro com um campo a mais, então esta change apenas acrescenta requisitos; arquivar esta depois da outra.

**6. Modo leitura reaproveita o padrão do escopo.**
MEMBER/VIEWER veem a descrição como texto; quando vazia, o mesmo traço "—" usado pelo escopo, mantendo a leitura previsível sem controles de edição.

## Risks / Trade-offs

- **Divergência entre o card truncado e a descrição longa** → o limite de 20.000 é o da API; o card já trunca visualmente e nada muda nesse comportamento.
- **Usuário esperar Markdown porque "Escopo" tem editor rico ao lado** → o placeholder deixa explícito que é o resumo exibido no card, e a decisão 2 documenta o porquê.
- **Ordem de arquivamento das duas changes na mesma capability** → mitigado pela decisão 5 (só adição) e registrado nas tasks de encerramento.
- **`description` com `''` vindo de projetos antigos** → tratado como vazio na comparação (`?? ''`), sem efeito no card.

## Migration Plan

Não há migração de dados nem de schema: o campo já existe, já é aceito pela API e só ganha superfície na interface. Rollback = reverter o commit do web; nenhum dado novo fica órfão.
