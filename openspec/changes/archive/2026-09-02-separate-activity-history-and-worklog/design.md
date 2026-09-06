## Context

Hoje `item_logs` armazena eventos automáticos de auditoria e registros manuais de trabalho. A API já cria eventos automáticos ao mover cards e ao editar campos, enquanto a `ActivityLogModal` lista ambos e também oferece o formulário manual. A mesma tela acabou tratando auditoria, diário e horas como uma única atividade; além disso, descrições geradas a partir de rich text podem conter HTML literal e a identidade do executor de operações via API/MCP não é apresentada de forma suficientemente explícita.

## Goals / Non-Goals

**Goals:**

- Oferecer duas experiências independentes: Histórico de alterações e Diário de trabalho.
- Garantir que auditoria seja completa, imutável, cronológica e identifique humano, API key ou agente.
- Garantir que o diário aceite duração `H:MM`, normalize para minutos e totalize somente trabalho manual.
- Corrigir a exibição de diferenças de rich text sem executar HTML não confiável.
- Manter isolamento multi-tenant, RBAC, APIs MCP e compatibilidade com dados existentes.

**Non-Goals:**

- Não transformar o histórico em um sistema de aprovação ou versionamento completo de documentos.
- Não criar apontamento de horas por calendário, timer em tempo real ou faturamento.
- Não alterar a regra de hierarquia, Leaf Rule ou o payload principal de criação/edição de cards.
- Não apagar automaticamente registros históricos existentes durante a migração.

## Decisions

1. **Separar por tipo lógico, preservando a tabela atual inicialmente.**
   - Auditoria continuará com `type = auto`; diário continuará com `type = manual`, mas cada endpoint e componente filtrará explicitamente seu domínio.
   - Adicionar metadados de origem (`REST`, `MCP`, `SYSTEM`) e executor/agente quando necessário, em vez de criar duas tabelas imediatamente. Isso reduz migração e mantém relatórios existentes.
   - Alternativa rejeitada: duas tabelas desde o primeiro passo. Seria conceitualmente limpa, mas aumentaria migração, joins e risco de quebrar consumidores atuais.

2. **API dedicada para cada conceito.**
   - Histórico: endpoint somente leitura para eventos automáticos, com contagem e paginação.
   - Diário: endpoints de listar/criar/editar/excluir registros manuais, com RBAC e validação de duração.
   - O frontend não inferirá o tipo filtrando somente no cliente quando uma consulta específica puder fazê-lo no servidor.

3. **Duração canônica em minutos, entrada apresentada como `H:MM`.**
   - Aceitar horas sem limite artificial e minutos de `00` a `59`; exemplos válidos: `2:00`, `8:00`, `29:00`, `0:50`.
   - Converter no backend e armazenar `duration_min` como inteiro. O frontend exibirá novamente o valor normalizado em `H:MM`.
   - Alternativa rejeitada: armazenar string. Isso dificulta soma, validação e relatórios.

4. **Auditoria com identidade e origem explícitas.**
   - Usuário autenticado será o autor humano; operações com API key terão a identidade da API key/agente disponível e manterão o usuário de contexto quando existir.
   - A interface exibirá nome, avatar/ícone e uma indicação como “Humano”, “Agente” ou “Sistema”. Eventos automáticos não serão editáveis.

5. **Rich text será convertido para texto de auditoria seguro.**
   - Descrições de mudanças serão geradas a partir de texto sem marcação ou de uma representação segura de diff; tags HTML nunca serão interpoladas diretamente como texto de evento sem normalização.
   - O histórico continuará renderizando a descrição como texto, não HTML arbitrário.

6. **Modal principal com dois accordions independentes.**
   - `Histórico de alterações` exibirá contagem de eventos automáticos e abrirá a lista de auditoria.
   - `Diário de trabalho` exibirá contagem de lançamentos e total de horas, com ação “Registrar trabalho”.
   - A ação de registrar trabalho não ficará dentro do histórico.

## Risks / Trade-offs

- [Registros antigos não possuem origem ou distinção perfeita] → classificar `auto` como auditoria e `manual` como diário; usar `SYSTEM`/“Origem não identificada” quando não houver metadado.
- [Mudança de contrato pode afetar clientes MCP] → manter endpoints legados de leitura por uma transição e documentar os novos endpoints; não remover campos existentes sem migração.
- [Descrições antigas podem conter HTML literal] → aplicar normalização apenas na apresentação e, para novos eventos, gerar texto seguro; cobrir ambos em testes.
- [Eventos duplicados em retries de movimentação] → manter a operação transacional e considerar chave/idempotência da ação antes de inserir o evento.
- [Contagens adicionais aumentam consultas] → usar endpoint/resposta agregada com `total`, índices por `tenant_id`, `item_id`, `type` e ordenação por data.

## Migration Plan

1. Adicionar colunas opcionais de origem/identidade do executor e índices necessários.
2. Classificar registros atuais por `type`, mantendo os dados e preenchendo valores de fallback.
3. Implementar endpoints e serviços separados, mantendo leitura legada durante a transição.
4. Migrar a UI para os dois accordions e validar contagens, permissões e horas.
5. Após confirmar que consumidores usam os novos contratos, depreciar o formulário manual dentro do histórico, sem remover dados.

Rollback: desligar a nova UI por feature flag/configuração, manter os endpoints legados e não desfazer registros já gravados. A migração de colunas é aditiva e pode permanecer sem afetar o comportamento anterior.

## Open Questions

- Qual nome público deve representar agentes: nome da API key, nome do agente MCP ou ambos?
- Devemos permitir diário sem duração ou tornar horas obrigatórias para todo lançamento?
- A exclusão de um lançamento manual deve ser permitida a seu autor ou somente edição/correção?
