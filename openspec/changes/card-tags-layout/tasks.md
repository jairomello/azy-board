# Tasks

## 1. Estrutura da linha de metadados

- [x] 1.1 Separar tags e status/tipo em duas faixas no `KanbanCard`, verificando no teste de contrato que a região de etiquetas continua entre título e progresso.
- [x] 1.2 Aplicar altura fixa (`h-5`), `whitespace-nowrap` e truncamento nas tags, status e tipo, verificando em teste de componente que nomes longos não criam segunda linha.

## 2. Excesso e nomes longos

- [x] 2.1 Limitar a duas tags visíveis e renderizar `+N` com tooltip e nome acessível, verificando com teste os casos 0, 1, 2 e 3+ tags.
- [x] 2.2 Garantir `title` com o nome completo em cada tag truncada e verificar no teste de componente.

## 3. Visual e temas

- [x] 3.1 Aplicar a pílula com fundo tênue e ponto colorido no card, verificando nos temas claro e escuro que o texto continua legível.
- [x] 3.2 Conferir o resultado contra o mockup `openspec/changes/card-tags-layout/mockups/card-tags-layout.svg` nas densidades confortável e compacta.

## 4. Verificação e documentação

- [x] 4.1 Rodar `bun run check` e `bun run test:smoke`, registrando falhas ambientais separadamente.
- [x] 4.2 Validar `bun run openspec:validate` e `bun run check:docs`.
- [x] 4.3 Atualizar `CHANGELOG.md` com o novo layout das etiquetas.

## Workflow follow-up

- Arquivar a change após o merge e a validação dos artefatos.
