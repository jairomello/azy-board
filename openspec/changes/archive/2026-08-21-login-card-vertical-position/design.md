## Context

A `LoginPage` usa um card em grid com dois painéis. O card ocupa a altura disponível do container e, na referência desejada, precisa ficar menor e centralizado verticalmente dentro da área cinza, mantendo o painel institucional e o formulário com a mesma altura natural.

## Goals / Non-Goals

**Goals:**

- Fazer o card desktop ter altura baseada no conteúdo, com espaçamento vertical explícito ao redor.
- Centralizar o card na viewport sem criar uma altura artificial no formulário.
- Manter o layout responsivo e evitar overflow quando a altura da viewport for pequena.

**Non-Goals:**

- Não alterar autenticação, textos, campos ou estilos internos do formulário.
- Não adicionar imagem de fundo nesta mudança.
- Não alterar API, banco, rotas ou dependências.

## Decisions

- **Container externo:** usar alinhamento vertical central no wrapper da página e padding vertical responsivo, em vez de deixar o card crescer pela altura mínima da viewport.
- **Altura do card:** remover qualquer combinação de `min-h`/`h-full` que faça o grid ocupar toda a viewport; deixar a altura ser determinada pelo painel mais alto.
- **Respiro em telas pequenas:** manter `min-h-screen` e `overflow-y-auto` no wrapper, permitindo rolagem quando o conteúdo exceder a altura disponível.
- **Painel do formulário:** preservar `flex items-center justify-center`, mas sem `h-full` ou `min-h` no painel, para centralizar o conteúdo dentro da altura natural do card.

Alternativa considerada: aplicar apenas `transform: translateY(...)` no card. Foi rejeitada porque desloca visualmente o elemento sem resolver a relação entre altura natural, viewport pequena e overflow responsivo.

## Risks / Trade-offs

- **[Risk]** Em uma viewport desktop muito baixa, o card pode exceder a área visível. **Mitigation:** permitir overflow vertical no wrapper e manter paddings menores nos breakpoints mobile.
- **[Risk]** Alterar o alinhamento do wrapper pode afetar a composição mobile. **Mitigation:** aplicar a centralização de forma responsiva e validar mobile, tablet e desktop.
