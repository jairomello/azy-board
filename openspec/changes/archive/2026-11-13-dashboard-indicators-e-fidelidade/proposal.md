# Indicadores de prazo e fidelidade do Dashboard

## Why

O Dashboard passou a exibir o box **Prazo** (SPI, dias para o término, conclusão, avanço e higiene) e teve os números corrigidos para refletir o board: cada indicador ganhou uma população explícita, dependências externas saíram do progresso, o N/A deixou de contaminar conclusão e WIP, e o responsável externo passou a ser reconhecido. Nada disso estava registrado no OpenSpec — o spec ainda descrevia nove boxes e não conhecia `/dashboard/indicators`.

## What Changes

- **Box Prazo**: SPI, dias para o término, conclusão, avanço no fluxo e higiene da base via `GET /projects/:id/dashboard/indicators`.
- **Dez boxes**: inclui Prazo; Sprint e Versões continuam fora.
- **Populações explícitas por indicador**: progresso/SPI sem N/A; tokens em qualquer status; carga só com trabalho em andamento; atraso pela regra vigente com universo próprio.
- **Dependências externas** (`EXTERNAL`) fora do progresso, contadas à parte.
- **Responsável externo** (`assigneeLabel`) reconhecido na higiene e separado de “sem responsável”.
- **Leitura por KPI**: controle de informação em cada quadro e em cada KPI do box Prazo.
- **WIP com três fatias**: em andamento, em homologação e bloqueado, com legenda correspondente.

## Impact

- Specs: `project-dashboard`.
- API: `GET /projects/:projectId/dashboard/indicators` (somente leitura) e ajustes de população no `/snapshot`.
- UI: novo box, legenda do WIP, notas de escopo e tooltips de leitura.
- Sem migration e sem alteração de dados.
