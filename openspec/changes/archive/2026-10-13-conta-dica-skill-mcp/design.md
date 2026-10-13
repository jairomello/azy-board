# Design

## Context

- O painel de orientação vive em `apps/web/src/components/McpConnectionGuide.tsx`, renderizado no topo de `ApiKeysSection.tsx`, e já mostra explicação, URL do MCP copiável e cópia da instrução para o agente.
- A skill oficial documenta o comando `/azyboard-setup-mcp` (`skills/azyboard/commands/setup-mcp.md`), que conduz a configuração do MCP nos modos stdio e remoto, com conexão assistida por `scripts/connect-mcp.mjs` (a chave é pedida no terminal, nunca no chat).
- Os comandos são descritivos: clientes sem slash commands usam o mesmo nome e intenção em linguagem natural (`skills/azyboard/commands/README.md`).
- i18n por namespaces em `apps/web/src/i18n/locales/{pt-BR,en,es}/settings.json`; o gate `check:i18n` exige paridade e valida texto de produto via AST.

## Goals / Non-Goals

**Goals:**
- Tornar visível, na própria tela, que o agente pode configurar o MCP pelo usuário com a skill oficial.
- Manter a dica curta, traduzida e sem qualquer menção de credencial.

**Non-Goals:**
- Não executar ou detectar o comando no cliente; a dica é informativa.
- Não alterar os controles de cópia existentes, as rotas ou contratos.

## Decisions

### D1. Dica como parágrafo no painel existente
A dica entra como um parágrafo curto ao final do `McpConnectionGuide`, dentro do mesmo painel, junto da orientação — evita fragmentar a leitura e reaproveita o contexto já montado. Alternativa: card separado na página — rejeitada pelo mesmo motivo de D2 da mudança `conta-conexao-mcp`.

### D2. Texto único em i18n com o comando interpolado
Uma chave nova (`mcpGuideSkillHint`) recebe o comando por interpolação (`{{command}}`), vindo de uma segunda chave (`mcpGuideSkillCommand`). Assim o texto é traduzível e o comando aparece no idioma certo sem literal hardcoded no JSX (exigência do gate `check:i18n`). Alternativa: `<Trans>` com componente `<code>` — rejeitada por não haver uso de `Trans` no projeto; o estilo do comando fica a cargo do texto.

### D3. Sem link nem botão para o comando
O comando é apenas texto: a invocação real depende do cliente do usuário (slash command, prompt em linguagem natural ou cole na conversa). Um botão "executar" não teria como agir a partir do navegador.

### D4. Ícone discreto e tom de dica
A dica usa um ícone pequeno e cor de texto secundária, para não competir com a URL e os botões de cópia (que são a ação principal do painel).

## Risks / Trade-offs

- **Comando divergente do documentado** → o texto cita exatamente `/azyboard-setup-mcp`, o mesmo nome do arquivo em `skills/azyboard/commands/`; testes verificam a presença da skill e do comando.
- **Dica virar ruído visual** → uma linha, com ícone discreto, no fim do painel.
- **Divergência de i18n** → `check:i18n` no CI impede merge sem paridade.

## Migration Plan

Sem migração de dados. Deploy normal da imagem web. Rollback: reverter o commit.

## Open Questions

Nenhuma que altere specs, abordagem ou tarefas.
