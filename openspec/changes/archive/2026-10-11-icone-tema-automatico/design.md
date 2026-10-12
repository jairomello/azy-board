## Context

Ver `proposal.md` — Why. Estado atual relevante:

- `apps/web/src/components/ThemeToggle.tsx` (30 linhas) renderiza um `<button>` com `title`/`aria-label` nativos e ícones `Moon`/`Sun`; **não** possui `disabled` nem lê `autoThemeByTime`.
- A preferência vive em `user.autoThemeByTime` (`apps/web/src/contexts/AuthContext.tsx:20`) e é aplicada em `apps/web/src/lib/theme.ts`; o seletor manual da `AccountPage` já fica desabilitado quando o automático está ligado (`AccountPage.tsx:67`), mas o header não.
- O primitivo de tooltip do projeto é `apps/web/src/components/ui/Tooltip.tsx` (`<div className="relative group">` + camada de hover no wrapper) e já é usado em botões-ícone do `AppShell`/`BoardFilters`.
- `lucide-react` 0.460 fornece `SunMoon` (não existe "moon slash sun").
- As chaves de tema existem em `apps/web/src/i18n/locales/{pt-BR,en,es}/settings.json`; o gate `scripts/check-i18n.ts` exige paridade e proíbe texto fixo.
- O spec `theming` já cobre o seletor manual desabilitado, mas não o botão do header.

## Goals / Non-Goals

**Goals:**
- Sinalizar de forma clara, no botão do header, que o modo automático está ativo e a troca manual está indisponível.
- Manter o comportamento atual quando o modo automático está desligado.
- Preservar acessibilidade e paridade de idiomas.

**Non-Goals:**
- Alterar a lógica do tema automático por horário ou a persistência.
- Mudar o seletor manual da página de conta.
- Criar ícone SVG próprio (será usado `SunMoon` do lucide) ou adicionar estado "seguir o sistema".

## Decisions

### D1. Ícone `SunMoon` do lucide-react
Usar o ícone combinado já disponível (`SunMoon`) importado no próprio `ThemeToggle`, como já ocorre com `Moon`/`Sun`. Motivo: existe pronto, sem novo asset nem dependência; o card permite usar um ícone pronto. Alternativa rejeitada: criar SVG "lua-barra-sol" inline, sem precedente no projeto e sem ganho proporcional.

### D2. Botão desabilitado + tooltip via wrapper
No modo automático, aplicar `disabled` ao `<button>` e envolver o botão no `Tooltip` do projeto (`ui/Tooltip.tsx`), cujo hover reside no wrapper — assim a dica funciona mesmo com o botão desabilitado (o `title` nativo costuma não aparecer em controles desabilitados). Alternativa rejeitada: manter apenas `title`, que pode não exibir a dica.

### D3. Fonte do estado: `user.autoThemeByTime`
O `ThemeToggle` passa a ler `user?.autoThemeByTime` do `AuthContext` para escolher entre a variante manual (atual) e a variante automática. Motivo: é a mesma fonte usada pela página de conta e não exige novo contrato.

### D4. Texto da dica via i18n dedicada
Nova chave no namespace `settings` (ex.: `themeAutoToggleDisabled`) com o valor pt-BR exato "Desabilitado - modo automático selecionado." e traduções equivalentes em en/es. Motivo: o gate `check:i18n` exige os três locales e proíbe string fixa.

### D5. Rótulo acessível coerente
Com o modo automático ligado, o rótulo acessível (`aria-label`) comunica o motivo da indisponibilidade em vez de descrever a ação de alternância; com o automático desligado, mantém o rótulo atual ("Claro"/"Escuro"). Motivo: evitar rótulo contraditório em botão desabilitado.

### D6. Estilo coerente com o restante do app
Reusar a convenção de desabilitado (`disabled:opacity-50 disabled:cursor-not-allowed`, como na `AccountPage`) e conferir o contraste no header, que aplica overrides de shell (`[&_.shell-control]` em `AppShell.tsx`). Motivo: manter legibilidade do ícone/dica no shell claro.

### D7. Sem mudança de backend
`autoThemeByTime` já existe no tipo, no `PATCH /users/me` e no estado do usuário. Nenhuma migration ou contrato novo.

## Risks / Trade-offs

- **Dica em botão desabilitado** → usar o `Tooltip` com hover no wrapper; testar por componente.
- **Contraste do ícone desabilitado no header** → validar com os overrides de shell; ajustar opacidade se necessário sem perder a indicação.
- **Paridade i18n** → adicionar a chave nos três locales e rodar `check:i18n`.
- **Rótulo acessível contraditório** → variar o `aria-label` conforme o estado automático.
- **Confusão com "seguir o sistema"** → o ícone/tooltip deixam claro que é "automático por horário", e não um tema de sistema.
