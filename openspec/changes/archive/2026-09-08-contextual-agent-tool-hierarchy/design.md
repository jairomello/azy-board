## Context

O drawer do Azy Agent é global e aparece em todas as rotas protegidas quando o provider está habilitado. `AppShell` informa projeto e item em parte das telas, mas a escolha de tools ocorre por regex sobre a mensagem. Esse mecanismo confundiu termos presentes no conteúdo, como uma história chamada "Projetos", com intenção de criar projeto.

O catálogo compartilhado contém 57 tools. Enviar todas ao provider aumenta tokens e espaço de decisão; restringi-las rigidamente por rota, porém, impede pedidos legítimos. Um usuário autorizado pode pedir para criar um novo projeto enquanto está em um board, consultar outro projeto pelo nome ou registrar uma ação relacionada sem navegar primeiro.

A arquitetura deve maximizar conclusão autônoma:

```text
contexto atual -> tools prováveis -> intenção/alvo explícito
      |                                   |
      +-------- prioridade/default -------+
                                          v
                              busca de capability permitida
                                          |
                              corrigir dependências/erros
                                          |
                                  executar ou explicar
```

## Goals / Non-Goals

**Goals:**

- Reduzir schemas e escolhas iniciais sem reduzir as capacidades permitidas ao usuário.
- Usar tela/projeto/item como prioridade e alvo padrão quando a mensagem não define outro recurso.
- Permitir expansão dinâmica para qualquer domínio autorizado quando a intenção for explícita.
- Resolver dependências e erros recuperáveis sem devolver o trabalho ao usuário prematuramente.
- Manter autorização, tenant, aprovação e limites como fronteiras rígidas.
- Tornar o registry compartilhado pesquisável, consistente e auditável.

**Non-Goals:**

- Exigir que o usuário navegue para outra tela antes de executar uma capacidade autorizada.
- Criar allowlists rígidas por rota ou impedir tools globais em contextos de projeto.
- Criar tools-fachada `Projects`, `Tasks` ou similares que escondam operações nominais.
- Tentar contornar falta de permissão, aprovação rejeitada, tenant mismatch ou limites de custo.
- Implementar novas tools de dashboard, conta, usuários globais ou provider nesta change.
- Aceitar segredo, API key ou configuração de provider pelo chat.

## Decisions

### 1. Contexto prioriza; permissão limita

Tela, projeto e item atuais serão usados para ordenar tools e preencher defaults. Eles não formarão uma fronteira funcional. A fronteira rígida permanece composta por identidade, tenant, policy, escopo de API key, aprovação e limites operacionais.

Exemplos:

| Situação | Comportamento |
|---|---|
| Pedido de task no board sem projeto explícito | usa projeto e item atuais |
| Pedido de novo projeto dentro do board | carrega Projects, verifica papel global e cria sem exigir navegação |
| Pedido menciona outro projeto pelo nome | resolve o projeto explícito e não aplica o atual silenciosamente |
| Pedido ambíguo entre dois projetos | pergunta antes de mutar |
| Pedido sem permissão | para e explica a permissão real |

Alternativa rejeitada: matriz tela x tools como allowlist rígida. Ela reduziria a experiência, criaria navegação artificial e transformaria o agente global em um assistente local da página.

### 2. Hierarquia por metadados no registry

Cada tool nominal receberá:

```ts
interface ToolRoutingMetadata {
  domain: 'projects' | 'board' | 'items' | 'planning' | 'collaboration' | 'evidence' | 'account' | 'administration'
  scope: 'global' | 'project' | 'item'
  operation: 'read' | 'create' | 'update' | 'execute' | 'delete'
  risk: 'READ' | 'LOW' | 'MEDIUM' | 'HIGH' | 'DESTRUCTIVE'
  dependencyTools: string[]
  targetKinds: Array<'tenant' | 'project' | 'item'>
  policy: ToolPolicy
}
```

Domínios são índice de busca e progressive disclosure; não são tools executáveis. Isso preserva schema, preview, policy, idempotência e auditoria por operação.

### 3. Progressive disclosure em três níveis

O provider recebe toolsets evolutivos:

1. **Primário:** tools mais prováveis pelo contexto e intenção, com schemas completos.
2. **Dependências:** tools read-only declaradas para resolver nomes/IDs e contexto necessário.
3. **Cross-domain explícito:** tools de qualquer domínio quando o pedido indica claramente outra capacidade e a policy permite.

O nível inicial por tela funciona como ranking:

| Tela | Domínios primários |
|---|---|
| `/projects` | Projects |
| Board Kanban | Board, Items, Planning |
| Árvore | Board, Items, Planning/Modules |
| Dashboard | Board/Projects read |
| Project settings | Projects, Planning, Collaboration |
| Modal de item | Items, Evidence |
| Conta/admin | domínio local disponível e ajuda |

O conjunto de tools pode mudar entre rodadas da mesma run. O harness registra cada expansão em eventos existentes, sem exigir nova tabela na primeira implementação.

### 4. Busca interna de capabilities

O resolver mantém um índice compacto derivado do registry. A busca recebe intenção, entidades mencionadas, contexto e policy e retorna tools candidatas e dependency tools. O modelo não recebe os schemas de todas as tools nem vê capacidades proibidas.

A busca pode ser determinística no backend ou exposta ao modelo como uma capability técnica read-only que retorna apenas tools permitidas. A primeira implementação preferirá resolver server-side para não criar uma nova superfície pública MCP.

### 5. Precedência de alvo

O resolver aplica:

```text
recurso explícito e resolvido na mensagem
                > item selecionado
                > projeto da conversa/tela
                > pergunta de esclarecimento
```

Palavras em títulos, descrições, CSV e dados recuperados nunca definem intenção ou escopo. Somente a mensagem do usuário atual participa da resolução; conteúdo citado é tratado como dado não confiável.

Quando o alvo explícito difere do contexto atual, o agente pode operar nele se a policy permitir. Mutações destrutivas e ambiguidades sempre mostram o alvo no preview.

### 6. Recuperação automática de tool errors

Erros serão classificados:

**Recuperáveis e retornados ao modelo como function output:**

- recurso/dependência não encontrado;
- módulo, coluna, sprint ou parent ausente;
- schema/argumento inválido com código tipado;
- conflito por nome duplicado;
- tool ainda não carregada no conjunto atual;
- estado conflitante que pode ser relido e corrigido;
- HTTP transitório permitido pela política de retry.

O modelo pode carregar dependency tools, corrigir argumentos e tentar novamente dentro de steps, calls, custo e proteção contra loop. A assinatura repetida sem mudança continua bloqueada.

**Terminais:**

- autenticação/tenant/permission denied;
- API key fora de escopo;
- aprovação rejeitada, alterada ou expirada;
- limite de custo, token, payload, actions, steps, calls ou timeout;
- tentativa destrutiva sem aprovação;
- indisponibilidade persistente após retry seguro.

Alternativa rejeitada: transformar qualquer HTTP 4xx/5xx em falha terminal. Isso causou solicitações manuais desnecessárias em fluxos que o agente poderia corrigir.

### 7. Binding seguro sem aprisionamento

Projeto/item atuais serão injetados quando a mensagem não especifica outro alvo. Quando houver alvo explícito, o resolver o busca e revalida antes de substituir o default. O modelo não pode trocar IDs diretamente por argumentos; a troca ocorre por resolução server-side de entidade e policy.

O preview sempre identifica o alvo efetivo. Aprovação recomputa hash sobre tool, argumentos e alvo. A rota REST continua revalidando tudo no momento da execução.

### 8. Permissão antes da tool e novamente na execução

O catálogo dinâmico mostra apenas capabilities autorizadas. Uma capacidade fora do conjunto inicial, mas permitida, pode ser descoberta; uma capacidade proibida não é carregada. REST/RBAC permanece a última barreira.

Tools que escrevem, inclusive `claim_task`, `create_checklist`, `add_checklist_item` e `check_item`, serão classificadas como mutação. A rota de aprovação usará o fluxo seguro do harness e revalidará provider, policy, alvo e operation hash.

### 9. Resposta elegante como último recurso

O agente só explicará limitação depois de:

1. pesquisar capability permitida;
2. carregar dependências;
3. tentar correção recuperável dentro dos limites;
4. confirmar que falta implementação, permissão ou informação obrigatória.

Não haverá mensagem "vá para outra tela" para uma capacidade executável. Rotas podem ser sugeridas apenas como conveniência quando a operação não tem tool ou quando o usuário prefere fazê-la manualmente.

### 10. Paridade do catálogo

O trabalho inclui correções já identificadas: risco de tools de escrita, `list_attachments.itemId`, filtros de `list_tasks/get_tree` e datas de `create_sprint`. Um teste de catálogo impedirá divergência entre metadata, schema, validator, policy e dispatcher.

## Risks / Trade-offs

- [Expansão dinâmica aumenta tool calls] -> limitar expansões, registrar eventos e reutilizar dependency tools na mesma run.
- [Modelo pode tentar vários domínios] -> somente intenção explícita permite cross-domain; assinatura repetida e budgets encerram loops.
- [Contexto implícito pode atingir recurso errado] -> alvo explícito tem precedência e preview identifica projeto/item antes de mutação.
- [Policy metadata diverge do REST] -> metadata é pré-filtro; endpoint continua autorizando e testes verificam paridade.
- [Erros devolvidos ao modelo podem expor internals] -> usar códigos tipados e mensagens sanitizadas, sem SQL, stack ou IDs fora do escopo.
- [Catálogo inicial pequeno omite uma capability] -> busca interna pode carregar qualquer tool permitida; ausência inicial não é falha terminal.
- [Implementação complexa demais] -> rollout em fases e feature toggle, mantendo seletor legado até a matriz de regressão passar.

## Migration Plan

1. Enriquecer registry e corrigir schema/risco sem alterar seleção ativa.
2. Publicar contexto de tela/projeto/item como sinal de prioridade.
3. Implementar resolver e progressive disclosure sob feature toggle, em modo comparativo ao seletor legado.
4. Habilitar busca cross-domain e dependency tools permitidas.
5. Converter erros recuperáveis em outputs para continuação do modelo.
6. Endurecer binding, preview e aprovação com alvo efetivo.
7. Remover dependência principal de regex após testes e telemetria local.

Rollback: desabilitar o resolver adaptativo e retornar ao seletor atual. Metadados aditivos do registry permanecem compatíveis com MCP externo.

## Open Questions

- A busca de capability continuará totalmente server-side ou será disponibilizada ao modelo como tool técnica privada do Azy Agent?
- Quantas expansões cross-domain serão permitidas por run antes de exigir esclarecimento? Recomendação inicial: duas expansões distintas e no máximo uma por rodada.
- Conflito de nome duplicado pode ser resolvido automaticamente como "usar existente" em leitura; para mutação, a recomendação é confirmar quando houver mais de um alvo plausível.
