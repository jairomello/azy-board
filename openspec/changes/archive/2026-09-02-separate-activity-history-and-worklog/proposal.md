## Why

O histórico do card mistura dois conceitos profissionais diferentes: auditoria de mudanças do sistema e diário de trabalho com horas e anotações. Isso torna difícil entender o que realmente mudou no card, quem executou a mudança (pessoa ou agente) e quanto trabalho foi registrado. A separação é necessária agora porque a modal já expõe ambos como "atividades", mas apresenta eventos automáticos com descrição HTML bruta e não oferece um controle confiável de horas no formato usado pelas equipes.

## What Changes

- Separar **Histórico de alterações** e **Diário de trabalho** em recursos e áreas visuais distintos na modal do card.
- Manter no histórico somente eventos automáticos de rastreabilidade, como movimentação de coluna, alteração de campos, criação, arquivamento e mudanças feitas por integrações.
- Registrar em cada evento automático o executor real, distinguindo usuário humano de agente/robô, com nome, avatar ou identificação da integração e origem da operação.
- Exibir descrições de auditoria como texto seguro e legível, convertendo diferenças que contenham HTML/rich text para uma apresentação adequada, sem renderizar tags cruas.
- Criar um diário manual de trabalho separado, com autor preenchido automaticamente pelo usuário autenticado, descrição do trabalho realizado e duração obrigatória ou opcional em formato `H:MM`.
- Aceitar durações como `2:00`, `8:00`, `29:00` e `0:50`, armazenando internamente minutos para cálculo e relatórios.
- Exibir total de horas do diário separado do histórico de alterações.
- Mostrar contagens independentes nos accordions: quantidade de eventos de auditoria no Histórico e quantidade de registros no Diário.
- Permitir editar e excluir somente registros próprios do diário, respeitando ADMIN; eventos automáticos serão imutáveis.
- Preservar dados existentes por meio de classificação/migração explícita, sem apresentar registros automáticos antigos como diário de trabalho.

## Capabilities

### New Capabilities

- `card-work-log`: diário manual de trabalho com autor, descrição, duração `H:MM`, totalização e permissões.

### Modified Capabilities

- `card-activity-log`: restringir o histórico a auditoria automática, registrar origem e executor real, corrigir formatação e separar contagem/listagem do diário.
- `card-edit-ui`: apresentar Histórico de alterações e Diário de trabalho como seções independentes, com resumos, contagens e ações coerentes.

## Impact

- `apps/web/src/components/ItemModal.tsx`, `ActivityLogModal.tsx` e novos componentes para auditoria e diário.
- `apps/web/src/i18n/locales/*/common.json` para nomenclatura, estados, validações e origem humano/agente.
- `apps/api/src/routes/items.ts` e serviços de auditoria para classificação, autoria, origem e novos endpoints de diário.
- `apps/api/src/db/schema.ts` e migrações para separar eventos de auditoria de registros de trabalho ou adicionar tipo/origem compatíveis.
- Testes de API, frontend, permissões, parsing de duração, segurança de rich text e compatibilidade com registros existentes.
- Contratos de MCP/API que criam ou movimentam cards devem continuar gerando auditoria com o agente correto.
