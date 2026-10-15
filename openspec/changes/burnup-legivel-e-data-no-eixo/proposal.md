# Proposal

## Why

Duas queixas ligadas ao mesmo quadro do dashboard:

- **O burnup do NT-my-update parece quebrado.** Ele mostra uma faixa reta (a área do escopo, preenchida a 14% de opacidade) e uma linha de concluídos com altura zero. Não é falha de dados: nada foi concluído desde o início da cobertura (13/10) e o escopo é constante em 33. O quadro, porém, não diz isso — deixa a pessoa concluir que a tela está vazia.
- **Os rótulos de data do eixo estão um dia atrasados.** O eixo mostra `12/10 · 13/10 · 14/10` para os dados de 13, 14 e 15/10. Causa: `new Date('2026-10-13')` é interpretado como meia-noite UTC e formatado no fuso local (`America/Sao_Paulo`, UTC−3) vira 12/10. Defeito introduzido quando os eixos passaram a formatar pelo locale (T71).

Além disso, o recorte **Pontos** do burnup continua sendo oferecido em um projeto sem estimativas, contrariando a regra já vigente de omitir visões de pontos sem cobertura de estimativa (T70) — lacuna de implementação, não de especificação.

## What Changes

- Datas sem hora (`YYYY-MM-DD`) passam a ser formatadas na **data civil que representam**, sem deslocamento de fuso; instantes com hora continuam no fuso do usuário.
- O quadro de burnup, quando o período não tem conclusão nem variação de escopo, apresenta **mensagem explícita de ausência de evolução** em vez de um gráfico reto, preservando as notas de cobertura.
- O recorte de pontos do burnup deixa de ser oferecido quando a cobertura de estimativa é zero, seguindo a regra já existente para os demais quadros.

## Capabilities

### Modified Capabilities

- `i18n`: a formatação por locale passa a distinguir data civil de instante, proibindo deslocamento de dia em valores sem hora.
- `project-dashboard`: o burnup ganha estado explícito para período sem evolução.

## Impact

- **Web:** `shortDateTick` (`DashboardCharts.tsx`) passa a montar datas puras em horário local; o quadro de burnup (`ProjectDashboardPage.tsx`) ganha o estado sem evolução e condiciona o recorte de pontos à cobertura de estimativa.
- **i18n:** uma chave nova para a mensagem, nos três idiomas.
- **Orçamento de bundle:** o teto do chunk `index` sobe de 90 000 para 92 000 bytes gzip — a linha de base já estava a 10 bytes do teto (o chunk carrega os três idiomas), com o motivo registrado em `apps/web/bundle-budget.json`.
- **Servidor:** nenhuma mudança — a API já devolve a série correta.
- **Fora do escopo:** `version.releaseDate` (data de versão) tem o mesmo defeito de deslocamento, mas é anterior a este trabalho e fica registrado como observação.

## Board ref

B12 (data no eixo) e T78 (burnup legível) — projeto Azyboard.
