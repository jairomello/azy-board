## Context

A configuração Root atual em `apps/web/src/components/RootAssistantSettings.tsx` apresenta um único provider/modelo e envia provider, modelo e segredo aos endpoints `/assistant/root/provider*`. No backend, `assistant_settings` aponta para uma única credencial; o início da run descriptografa essa credencial, cria um único `ModelProvider` e o `AssistantHarness` reutiliza esse provider. O endpoint de mensagem já enfileira a run e responde `202`, e existe uma classe `AgentWorker`; porém, `startServer()` não inicia esse worker nem fornece um executor de run. Conectar a fila ao servidor é pré-requisito para a lista de modelos e o fallback funcionarem em chamadas reais.

A configuração é global ao tenant e atualmente só pode ser administrada por `ROOT`. As credenciais ficam cifradas em `assistant_credentials`. Os limites de governança e o toggle global permanecem no registro `assistant_settings`.

## Goals / Non-Goals

**Goals:**
- Manter uma quantidade variável de configurações de provider/modelo por tenant, com ordem explícita de prioridade.
- Permitir ao ROOT testar, incluir, editar, reordenar, habilitar/desabilitar e remover configurações.
- Ao falhar uma chamada ao modelo, prosseguir sequencialmente para a próxima configuração habilitada e validada.
- Preservar contexto e resultados de tools durante uma troca de provider, sem repetir operações já executadas.
- Migrar a configuração única atual sem interromper tenants existentes nem alterar seus limites ou estado global.
- Mostrar estado de configuração e disponibilidade sem expor segredos.
- Iniciar o worker in-process no lifecycle do servidor e executar runs pendentes a partir do contexto persistido, inclusive retomadas após aprovação/resposta.

**Non-Goals:**
- Selecionar modelos por conversa/projeto/usuário final ou permitir overrides no chat.
- Balancear carga, escolher modelo por preço/capacidade, executar tentativas em paralelo ou aprender a ordem automaticamente.
- Fazer fallback para erros de autorização, limites locais, validação de tool ou falha de execução de tool.
- Gerenciar catálogo remoto de modelos ou garantir compatibilidade funcional entre providers.

## Decisions

1. **Separar a lista ordenada das opções globais do tenant.** Criar uma tabela de configurações de modelo (`assistant_model_configs`, nome a confirmar durante implementação) com `id`, `tenant_id`, `provider`, `model`, `credential_id`, `position`, `enabled`, `validation_status`, `validated_at` e timestamps. `assistant_settings` continua sendo a fonte do toggle e da governança. Uma lista com posição ordenada foi escolhida em vez de colunas repetidas ou JSON: permite quantidade variável, atualização atômica da ordem, relacionamentos auditáveis e paridade entre SQLite e PostgreSQL.
2. **Usar a ordem ROOT como cadeia de fallback.** Para cada chamada de inferência, considerar apenas configurações habilitadas e validadas, em ordem crescente de posição. Começar pela primeira e avançar após esgotar a política de retry transitório existente para aquele modelo. Cada candidato participa no máximo uma vez da cadeia daquela chamada; tentativas permanecem sequenciais e respeitam o timeout/governança já aplicado. Não impor um número fixo de modelos configurados. Alternativa considerada: alternância round-robin; descartada porque torna imprevisível qual configuração é primária e ignora a prioridade administrativa.
3. **Restringir fallback à chamada do provider.** Só falhas retornadas pelo adapter/modelo acionam a próxima configuração (por exemplo, timeout/rede, rate limit, indisponibilidade HTTP ou credencial/modelo recusados pelo provider). Cancelamento da run, timeout global, autorização, limites de tokens/custo, erro de schema e falhas das tools não mudam de modelo por conta própria. Se todos os candidatos falharem, finalizar a run pelo caminho de erro existente com resposta agregada sanitizada. Isso evita mascarar defeitos locais ou repetir mutações.
4. **Manter um transcript neutro entre adapters.** Uma troca pode ocorrer depois de uma resposta e de uma tool call concluída. O harness deve manter o transcript normalizado de mensagens, chamadas e resultados das tools e usá-lo ao mudar de provider, sem depender de um `previousResponse.id` específico do provider. Resultados de tools concluídas são reutilizados no contexto da próxima inferência; nenhuma tool é reexecutada como parte do fallback. Não usar fallback de streaming após enviar deltas ao cliente, para não duplicar texto; a política vale para as chamadas atuais `createRun` do harness.
5. **Isolar credencial e configuração por tenant.** Cada configuração referencia uma credencial cifrada no backend. Toda consulta, alteração, ativação, remoção e resolução do segredo verifica simultaneamente tenant e identificador. O segredo só é aceito no teste/cadastro/rotação e nunca é retornado; o browser recebe apenas provider, nome do modelo, prioridade, enabled, status de validação e prefixo mascarado.
6. **Compatibilizar a disponibilidade.** `assistant_settings.enabled` continua sendo o controle global. `configured` é verdadeiro quando existe ao menos um modelo enabled e `VALID`; remover/desabilitar todos torna o agente não configurado e impede habilitá-lo. A projeção de disponibilidade para usuários não ROOT continua mínima e sem revelar a lista ou credenciais.
7. **Migrar a configuração singleton como primeira opção.** A migration cria a nova tabela e materializa, para cada tenant com `credential_id` configurado, uma entrada enabled na posição inicial, associada à mesma credencial/provider/modelo e estado de validação. Mantém o toggle e os limites existentes. O runtime passa a resolver pela lista; campos singleton são mantidos temporariamente para rollback e compatibilidade, sem continuar sendo a fonte de seleção após a migration.
8. **Expandir a seção existente de configuração Root.** Manter disponibilidade e governança no topo da tela; substituir o formulário singleton por lista ordenada de cartões com estado, provider/modelo, posição, indicador principal/fallback, habilitar/desabilitar, editar, testar e remover. A inclusão/edição ocorre em formulário dedicado dentro da seção; reordenação oferece controles explícitos acessíveis, além de drag-and-drop se o padrão de interface já suportar teclado. A hierarquia proposta está em `model-fallback-prototype.svg`.
9. **Conectar o worker na inicialização do servidor.** `startServer()` inicia `startAgentWorker()` com um callback de execução que reconstrói ator, tenant, conversa, ferramentas autorizadas e cadeia de modelos a partir do banco; nenhum dado de identidade ou segredo vem de argumentos do job. Usar o worker existente evita introduzir um processo/dependência externa e faz a fila persistente já existente consumir as respostas `202` no perfil SIMPLE e ADVANCED.

## Risks / Trade-offs

- [Muitos modelos podem ampliar o tempo de uma run se vários providers falharem] → preservar um orçamento total de timeout por chamada de inferência, aplicar as tentativas sequencialmente e parar quando a run for cancelada ou o orçamento expirar.
- [Responses API e Chat Completions não compartilham IDs de continuação] → usar transcript canônico na troca de provider, não IDs nativos da resposta anterior.
- [Uma credencial pode ser revogada ou perder acesso depois do teste] → tratar falha de autenticação/modelo como falha daquela configuração, tentar a próxima e manter status/erro sanitizado para o ROOT.
- [Reordenação concorrente pode produzir posições duplicadas] → gravar a nova ordem em uma única transação e normalizar posições sequenciais por tenant.
- [Remover uma configuração pode revogar credencial ainda referenciada] → confirmar que a credencial é exclusiva/sem outras referências antes de revogar; executar remoção e atualização da configuração atomicamente.
- [Migração ou rollback pode misturar singleton e lista] → manter os campos antigos durante a janela de rollback, documentar a precedência da lista e testar migration idempotente em SQLite e PostgreSQL.
- [Worker pode pegar uma run antes de a configuração ser revalidada ou depois de mudança de permissão] → recarregar identidade, disponibilidade, governança e cadeia de modelos do banco para cada run e revalidar autorização antes de cada tool.

## Migration Plan

1. Adicionar migration compatível em SQLite e PostgreSQL, criar a tabela ordenada e importar as configurações singleton existentes sem mudar o toggle global.
2. Publicar API de listagem e operações Root; a disponibilidade deve consultar a lista nova após a migration.
3. Iniciar o worker em `startServer()` e executar cada run com contexto reconstruído/revalidado do banco.
4. Atualizar o worker/harness para carregar configurações enabled/VALID do tenant e executar a cadeia de fallback.
5. Trocar a seção provider da tela ROOT pela lista de modelos; manter governança e disponibilidade no mesmo fluxo.
6. Validar migration, worker, fallback entre adapters, isolamento multi-tenant, `bun run check` e `bun run test:smoke` antes do rollout.

Rollback: voltar a usar os campos singleton de `assistant_settings` e o provider legado, mantendo a nova tabela e credenciais sem removê-las. Não apagar configurações importadas durante rollback; nenhuma migration destrutiva faz parte do primeiro rollout.

## Open Questions

- A política proposta usa a ordem da lista para o primário e todos os fallbacks, com cada configuração tentada uma vez por chamada após os retries transitórios já existentes. Não há decisão pendente que impeça a implementação.

Board ref: 64203ebf-a76c-44ba-952e-e06ed53c616b

Protótipo da tela: [model-fallback-prototype.svg](model-fallback-prototype.svg).
