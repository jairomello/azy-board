## Context

O MCP autentica agentes por uma API Key vinculada a um Owner humano e encaminha operações para a API do Azy Board. A autorização precisa ser composta a partir do grupo global persistido do Owner, de sua membership no projeto e do escopo restritivo da própria chave. O cliente MCP, os argumentos da ferramenta e o texto do prompt são não confiáveis.

## Goals / Non-Goals

**Goals:**

- Reutilizar a mesma hierarquia `TEAM_MEMBER < MANAGER < ADMIN < ROOT` no caminho MCP.
- Garantir que cada ferramenta obtenha autorização server-side antes de ler ou mutar dados.
- Manter o MCP limitado ao tenant, projetos e permissões efetivas do Owner.
- Fazer API Keys apenas restringirem, nunca ampliarem, as permissões do Owner.
- Cobrir leituras, mutações, operações administrativas e tentativas de bypass com testes isolados.

**Non-Goals:**

- Criar novos grupos, permissões customizadas ou delegação entre usuários.
- Permitir que o MCP administre tenants ou execute as funções globais futuras de Root.
- Substituir a autorização existente da API REST ou confiar em validação exclusiva no cliente MCP.

## Decisions

- **Resolver Owner no servidor:** a API Key será validada por hash e associada ao usuário pelo par `owner_id + tenant_id`; o grupo será lido do banco em cada contexto autenticado. Confiar no grupo codificado na chave ou no payload foi descartado porque permite privilégios obsoletos ou forjados.
- **Camada única de autorização reutilizável:** centralizar predicados de grupo, escopo de projeto, papel de membership e escopo da chave, usados tanto pelas rotas REST quanto pelo adaptador MCP. Implementar regras paralelas nos handlers MCP foi descartado por criar divergência.
- **Fail closed:** ausência de Owner, grupo inválido, tenant inconsistente, membership ausente ou autorização não reconhecida resulta em erro não autorizável antes da operação. Filtros frouxos ou fallback para Admin foram descartados.
- **Escopo da API Key é interseção:** `projectScope` e `permissionScope` somente reduzem o conjunto permitido pelo Owner. Uma chave sem escopo não cria privilégios extras; uma chave com escopo inválido é rejeitada.
- **Verificação por ferramenta e recurso:** ferramentas de projeto resolvem e autorizam o projeto antes da consulta; ferramentas administrativas exigem `ADMIN`/`ROOT`; mutações usam o nível mínimo correspondente e preservam a autorização local do projeto. Validar somente na abertura da sessão MCP foi descartado porque a chave pode ser reutilizada entre chamadas.
- **Erros MCP seguros:** retornar código estável, mensagem sem IDs ou dados de recursos não autorizados e indicação de retry apenas para falhas transitórias. Não diferenciar projeto inexistente de projeto fora do escopo quando isso revelar existência.
- **Revogação e alterações imediatas:** cada chamada valida chave revogada/expirada e o grupo persistido atual. Assim, alterar o grupo ou revogar a chave tem efeito sem reiniciar o processo MCP.

## Risks / Trade-offs

- [Consulta MCP e API REST podem divergir] -> compartilhar os mesmos predicados e adicionar testes de contrato para os dois caminhos.
- [Owner perde acesso enquanto um agente está ativo] -> revalidar banco e escopos em toda chamada, não apenas no handshake.
- [Alguma ferramenta nova esquecer a autorização] -> exigir um wrapper de execução autorizado e teste de catálogo que falhe para ferramentas sem política declarada.
- [Mensagens de erro revelarem recursos] -> mapear falhas de escopo para respostas seguras e evitar retornar nomes, IDs ou contagens fora do escopo.
- [API Key com escopo amplo ser interpretada como privilégio] -> validar sempre a interseção com o grupo/membership do Owner e testar escopos conflitantes.

## Migration Plan

1. Extrair ou adaptar os predicados de autorização existentes para serem consumidos pelo MCP sem alterar a política REST.
2. Aplicar o contexto efetivo do Owner ao middleware/adaptador MCP e bloquear ferramentas sem autorização declarada.
3. Atualizar ferramentas de descoberta, projeto, configuração e execução para validar cada recurso antes de operar.
4. Adicionar testes por grupo, membership, tenant, escopo de chave, revogação e alteração de grupo.
5. Publicar sem migração de banco; em rollback, desabilitar as ferramentas protegidas ou retornar não autorizado, nunca liberar o comportamento anterior sem controle.

## Open Questions

- O tratamento de API Keys pertencentes a Owners associados a múltiplos tenants deverá acompanhar a definição futura de tenant ativo.
- O catálogo MCP deverá declarar explicitamente o nível mínimo e se exige membership quando novas ferramentas forem adicionadas.
