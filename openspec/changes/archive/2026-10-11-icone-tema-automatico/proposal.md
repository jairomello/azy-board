## Why

Com o "Tema automático por horário" ligado, o tema é decidido pelo horário local e o seletor manual da página de conta fica desabilitado. No entanto, o botão de tema do header (`ThemeToggle`) **continua ativo e sem sinalização**: clicar nele não muda o tema efetivo e o usuário não entende por quê. O card T56 pede que, no modo automático, o botão do header indique esse estado — ícone de claro/escuro combinado e tooltip explicativo — sem prometer uma troca manual que não acontece.

## What Changes

- **Botão do header passa a ficar desabilitado no modo automático**: quando `autoThemeByTime` estiver ligado, o `ThemeToggle` fica desabilitado e deixa de tentar alternar o tema.
- **Ícone combinado**: no modo automático o botão exibe o ícone `SunMoon` do lucide-react (sol + lua), sinalizando o controle automático.
- **Tooltip explicativo**: ao passar o mouse, o botão mostra "Desabilitado - modo automático selecionado." (via o primitivo `Tooltip` do app, que funciona em botão desabilitado), nos três idiomas (pt-BR, en, es).
- **Modo manual inalterado**: com o automático desligado, o botão mantém o comportamento atual (ícone Sol/Lua e alternância ao clicar).
- **Acessibilidade**: o botão desabilitado comunica o estado por rótulo acessível/tooltip; a dica permanece legível para quem usa teclado e leitores de tela.

## Capabilities

### New Capabilities
<!-- Nenhuma: a mudança ajusta o comportamento do controle de tema já existente. -->

### Modified Capabilities
- `theming`: o requisito "Tema automático por horário" passa a cobrir explicitamente o botão de tema do header (desabilitado com ícone combinado e dica), além do seletor manual já coberto.

## Impact

- **Web:** `apps/web/src/components/ThemeToggle.tsx` (estado desabilitado, ícone `SunMoon`, tooltip) e possivelmente `apps/web/src/components/AppShell.tsx` (container do controle) e `apps/web/src/i18n/locales/*/settings.json` (nova chave nos três idiomas).
- **Testes:** novo teste de componente do `ThemeToggle` (infra RTL/happy-dom já existente) cobrindo desabilitado + tooltip quando `autoThemeByTime` é verdadeiro; `bun run check:i18n` deve seguir verde com a nova chave.
- **Backend/contrato:** sem mudança — `autoThemeByTime` já existe no tipo de preferências, no `PATCH /api/users/me` e no estado do `AuthContext`; nenhuma migration.
- **Rastreabilidade:** Board ref: 4b98bada-daff-4985-9478-8296bde51fc5 (card T56).
- **Fora de escopo:** alterar a política de tema automático por horário, criar um ícone SVG próprio (será usado `SunMoon` do lucide), mudar o seletor manual da página de conta, adicionar um estado "seguir o sistema".
