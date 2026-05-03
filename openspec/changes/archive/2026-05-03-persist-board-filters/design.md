## Context

O estado de filtros do board (`BoardFilterState`) vive atualmente em `useState` dentro de `BoardPage.tsx`, inicializado com valores padrão vazios. Ao recarregar a página ou navegar para outra rota e voltar, o estado é zerado. A mudança é puramente client-side: sem alterações de API, banco ou schema.

## Goals / Non-Goals

**Goals:**
- Persistir o `BoardFilterState` por projeto no `localStorage` do navegador.
- Restaurar os filtros automaticamente ao abrir o board.
- Garantir que "Limpar filtros" apague também a entrada do `localStorage`.
- Manter filtros independentes por projeto (chave escoped por `projectId`).

**Non-Goals:**
- Sincronização de filtros entre abas ou dispositivos.
- Persistência server-side ou por usuário autenticado.
- Migração de estado persistido quando o schema de `BoardFilterState` mudar.

## Decisions

### Chave de armazenamento: `board-filters:<projectId>`

Cada projeto tem sua própria entrada no `localStorage`. Assim, um usuário que alterna entre projetos mantém contextos de filtro separados, sem interferência.

**Alternativa descartada**: chave única global — perderia o contexto ao trocar de projeto.

### Inicialização do estado a partir do `localStorage`

A função inicializadora do `useState` (lazy initializer) lê o `localStorage` uma única vez na montagem do componente. O valor é parseado como `BoardFilterState`; em caso de erro de parsing (dado corrompido), o estado padrão é usado como fallback.

```ts
const [filters, setFilters] = useState<BoardFilterState>(() => {
  try {
    const raw = localStorage.getItem(`board-filters:${projectId}`)
    return raw ? JSON.parse(raw) : DEFAULT_FILTERS
  } catch {
    return DEFAULT_FILTERS
  }
})
```

**Alternativa descartada**: `useEffect` de leitura pós-montagem — causa flicker visual pois o board renderizaria primeiro sem filtros.

### Escrita via `useEffect` reativo

Um `useEffect` observa `filters` e persiste no `localStorage` a cada mudança. Como o lazy initializer já popula o estado inicial, a primeira execução do efeito é uma escrita redundante, mas inofensiva.

```ts
useEffect(() => {
  localStorage.setItem(`board-filters:${projectId}`, JSON.stringify(filters))
}, [filters, projectId])
```

### Limpeza de filtros apaga o `localStorage`

Ao chamar `setFilters(DEFAULT_FILTERS)`, o efeito acima será disparado e gravará os valores padrão no `localStorage` — não é necessário chamar `localStorage.removeItem` explicitamente. O estado padrão persistido é idêntico a "sem filtros".

## Risks / Trade-offs

**[Risco] Filtros com referências obsoletas** (ex.: squad ou módulo deletado) → Mitigação: filtros cujos IDs não existem mais simplesmente não filtram nada, sem erro. O comportamento já existia antes desta mudança.

**[Risco] `localStorage` indisponível** (modo privativo agressivo, `SecurityError`) → Mitigação: envolver as operações em try/catch; fallback para o comportamento atual (sem persistência).

**[Trade-off] Filtros persistem mesmo após logout** → Aceitável: filtros não contêm dados sensíveis e o board exige autenticação para ser acessado.
