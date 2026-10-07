Board ref: 25667747-2b18-43b6-badc-a2e461527c44

## ADDED Requirements

### Requirement: Board composto por responsabilidades coesas
O Board SHALL separar filtros/população, drag/mutações, edição/arquivamento e contexto do agente em controllers/modelos/componentes coesos. `BoardScreen` SHALL compor esses fluxos sem executar HTTP ou implementar inline suas regras. A extração SHALL preservar Leaf Rule, preferências por projeto, densidade/layout, contexto/reveal/foco do agente e schema da fotografia.

#### Scenario: Troca de projeto com trabalho pendente
- **WHEN** usuário troca de projeto enquanto uma carga de modal ou subscription do agente do projeto anterior está pendente
- **THEN** resposta ou evento anterior não altera filtros, modal ou fotografia do projeto novo e subscriptions antigas são encerradas

#### Scenario: Filtros e contexto do agente
- **WHEN** usuário filtra e recolhe grupos e o agente executa reveal/foco ou comando de visão
- **THEN** somente a visão do projeto alvo é alterada, a fotografia reflete o recorte correto e preferências/layout permanecem compatíveis

### Requirement: Jornadas de conflito e reconciliação observáveis
A suíte SHALL exercer componentes renderizados e jornadas em navegador para login, Board/criação/edição/movimentação/reordenação, Settings, permissões e agente determinístico. SHALL verificar 409/revisão, 403, falha transitória, rollback concorrente e reconexão com lacuna usando estado observável. Testes de texto-fonte que aleguem comportamento SHALL ser substituídos somente após substituto verde; invariantes estruturais legítimos SHALL ter justificativa.

#### Scenario: Conflito na edição
- **WHEN** edição de item usa revisão antiga e o servidor devolve conflito
- **THEN** interface exibe feedback localizado, reconcilia estado atual e não mostra alteração rejeitada como salva

#### Scenario: Rollback concorrente
- **WHEN** uma movimentação otimista falha após chegar estado mais recente do servidor
- **THEN** a reconciliação preserva a atualização mais recente e não restaura cegamente snapshot antigo

#### Scenario: Permissão revogada
- **WHEN** usuário perde permissão antes de confirmar mutação na UI
- **THEN** negativa server-side produz feedback e estado consistente sem sucesso aparente ou repetição automática não autorizada

#### Scenario: Reconexão com lacuna
- **WHEN** cliente recebe exigência de ressincronização ou perde sequência de eventos
- **THEN** permanece em estado de reconciliação até refetch concluir e só depois apresenta sincronizado

### Requirement: Acessibilidade e bundle preservados
A extração SHALL respeitar `apps/web/bundle-budget.json` sem elevar orçamento para esconder regressão. Jornadas SHALL verificar operação por teclado ou alternativa acessível ao drag, foco inicial/devolução de modal, nomes acessíveis e feedbacks localizados em PT-BR/EN/ES. Auditoria automatizada SHALL não apresentar violações críticas ou sérias e SHALL ser complementada por verificação de teclado registrada.

#### Scenario: Modal e ação por teclado
- **WHEN** usuário abre/edita/fecha modal e move um card usando teclado
- **THEN** foco e rótulos acessíveis permitem concluir a ação e retornam ao controle de origem sem armadilha de foco

#### Scenario: Bundle excedido
- **WHEN** o build refatorado excede qualquer orçamento vigente de chunk
- **THEN** o gate falha e o change não é aceito por apenas reduzir linhas do componente
