## Context

O formulário de Task/Bug/Subtask usa grids e grupos de campos dentro de accordions. Alguns controles foram inseridos com margens próprias, fazendo História Pai e Tags perderem a separação vertical usada pelos campos Autor, Pontos e Datas.

## Goals / Non-Goals

**Goals:**

- Criar ritmo vertical uniforme e previsível entre labels, controles e grupos.
- Corrigir o trecho Datas → História Pai → Tags sem alterar a estrutura funcional.
- Evitar regressões em mobile, accordions e modal de texto expandido.

**Non-Goals:**

- Alterar campos, ordem funcional, conteúdo, validações ou contratos.
- Redesenhar a modal inteira ou modificar modais de História/Épico além de estilos compartilhados comprovadamente seguros.

## Decisions

- Usar espaçamento definido pelo container de grupos (`gap`/`space-y`) em vez de margens isoladas em campos específicos.
- Cada label ficará imediatamente associada ao seu controle com uma distância curta e constante.
- O grupo de Datas será tratado como uma unidade; História Pai e Tags serão grupos independentes com a mesma margem superior dos demais.
- Preferir classes utilitárias existentes do projeto para manter temas e breakpoints.
- Validar por teste estrutural que História Pai e Tags estão em wrappers de grupo com espaçamento, não em fluxo colado.

## Risks / Trade-offs

- **A modal pode ficar mais alta** → manter scroll interno e corrigir apenas espaçamentos inconsistentes.
- **Classes antigas podem depender da margem atual** → alterar somente wrappers do ItemModal e revisar mobile.
- **Accordion fechado não deve ganhar espaço extra** → aplicar espaçamento entre seções, não dentro de conteúdo oculto.

## Migration Plan

1. Inspecionar wrappers do ItemModal e identificar margens divergentes.
2. Padronizar classes de espaçamento e corrigir Datas/História Pai/Tags.
3. Executar testes, build e revisão visual em larguras desktop/mobile.
4. Rollback removendo as classes novas; nenhum dado é afetado.

## Open Questions

Nenhuma questão bloqueante.
