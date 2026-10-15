# Tasks

Board ref: T75 e T76 (projeto Azyboard)

## 1. Barra de avanço no card

- [x] 1.1 Resolver os pesos das colunas no board e calcular o avanço de cada card com a função compartilhada do domínio, passando-o ao card por prop opcional; verificar com teste de componente do board e confirmando que o preview de arraste continua renderizando (T75)
- [x] 1.2 Substituir a barra de checklist pela barra de avanço, mantendo o contador `marcados/total` quando houver checklist e omitindo a região quando o avanço for zero; verificar com teste de componente cobrindo card sem checklist, card com checklist parcial e card em coluna de trabalho não iniciado (T75)
- [x] 1.3 Adicionar o rótulo acessível de avanço no fluxo nos três idiomas e verificar com `bun run check:i18n` (T75)

## 2. Exibição de nomes em duas partes

- [x] 2.1 Criar o helper compartilhado de exibição de nomes (primeira + última parte, limite de 15 caracteres com reticências, nome completo devolvido à parte) com teste unitário cobrindo nome único, duas partes, três ou mais, espaços extras, acentos e limite exato (T76)
- [x] 2.2 Aplicar a regra nos chips de filtro ativo do board, no eixo da carga da equipe e na coluna Responsável da árvore, mantendo o nome completo em `title`/`aria-label`; verificar com teste de componente e com o teste de contrato estrutural das superfícies (T76)

## 3. Verificação integrada

- [x] 3.1 Rodar `bun run check` e `bun run test:smoke` verdes na árvore final; verificar com os dois comandos
- [x] 3.2 Confirmar em navegador, com sessão autenticada, que um card sem checklist exibe o avanço da coluna, que um card com checklist afina dentro da faixa e que nomes longos aparecem em duas partes com o nome completo no tooltip; verificar visualmente e por leitura do DOM

## Workflow follow-up

- Implementar a change com `/opsx-apply`.
- Encerrar os cards T75 e T76 no Azy Board com `complete_task` e confirmar `status: DONE` no board real.
