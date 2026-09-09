## 1. Header contextual

- [x] 1.1 Criar helper/componente testável para truncar nomes em no máximo 60 code points, adicionando `...` quando necessário.
- [x] 1.2 Atualizar `AppShell` para priorizar `projectName` quando `projectId` estiver presente e manter `contextLabel` como fallback.
- [x] 1.3 Adicionar tooltip/atributo acessível com o nome completo apenas quando o nome for truncado.

## 2. Testes e validação

- [x] 2.1 Atualizar/adicionar testes para nome curto, nome exatamente com 60 caracteres, nome longo e tela sem projeto.
- [x] 2.2 Executar `bun run check` e confirmar que board, dashboard e configurações continuam compilando e renderizando o header.
