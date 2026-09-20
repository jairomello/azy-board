## Context

O item 25 da análise pedia remover código morto do MCP e tornar `registry.ts` a única fonte de ferramentas. A primeira parte já foi feita: `apps/mcp/src/index.ts` hoje é um adaptador de transporte com 177 linhas, sem `false ? [...]`, sem switch inalcançável e sem tabela manual de validação. O que restou é a segunda parte, ainda não atendida.

Hoje a definição de uma ferramenta está espalhada por várias estruturas manuais que precisam concordar:

- `registry.ts`:
  - `required: Record<string, string[]>` — obrigatórios reais (usado por `requiredFieldsFor`).
  - `fieldsByTool: Record<string, string[]>` — lista de campos aceitos por ferramenta (alimenta o schema).
  - Conjuntos de classificação: `discovery`, `planning`, `projectTools`, `boardTools`, `planningTools`, `collaborationTools`, `evidenceTools`, `destructiveTools`, `createTools`, `updateTools`.
  - `routingFor(name)` — deriva domain/scope/operation/risk/screens a partir desses conjuntos.
  - `friendlyNames` e `SKILL_COMMAND_INTENTS` — nomes amigáveis e intenções.
  - `executeSharedTool` — um `switch` de ~60 casos ligando nome a executor.
- Arquivos paralelos:
  - `validation.ts` mantém **outra** `requiredByTool` — e já divergiu: `create_sprint` exige `startDate`/`endDate` lá e não em `registry.ts`; `create_checklist` e `add_checklist_item_to_task` também diferem.
  - `limits.ts` mantém `TOOL_TEXT_LIMITS`, referenciado tanto pelo schema quanto pelo validador.
- `index.ts` ainda remonta o schema para exposição (`withOptionalFields`, `withOptionalProjectId`) por cima do que o registry gera.

Resultado: mudar uma ferramenta exige editar 3–5 lugares. Foi essa classe de divergência que gerou os cards recentes do MCP (schema marcando opcionais como required, validador rejeitando `null`, limites de texto diferentes da API). O gate `scripts/check-mcp-catalog.ts` só verifica presença de documentação/dispatcher, não que as tabelas concordam entre si.

## Goals / Non-Goals

**Goals:**
- Uma definição por ferramenta como fonte de verdade, em `registry.ts`.
- Derivar schema (MCP e strict), obrigatoriedade, routing, limites e validação dessa definição.
- Eliminar as duplicatas: `requiredByTool` de `validation.ts`, `fieldsByTool`, os conjuntos de routing e `limits.ts` como tabela paralela.
- Preservar o comportamento observável: mesmo schema exposto, mesmas mensagens de erro, mesmos executores.
- Corrigir as divergências reais já existentes, agora visíveis, com teste de contrato que as impede de voltar.

**Non-Goals:**
- Criar pacote compartilhado para o import direto da API no MCP (item 26).
- Mudar policies de permissão, transporte stdio, contratos HTTP ou formato de resposta das ferramentas.
- Reescrever os executores de `tools.ts` (assinaturas ficam estáveis).
- Introduzir dependência externa de validação de schema.

## Decisions

### 1. Descritor único por ferramenta (fonte de verdade)

Cada ferramenta passa a ser um objeto em um array/registro tipado, contendo no mesmo ponto:

```ts
type ToolField = {
  name: string
  type: 'string' | 'number' | 'boolean' | 'string[]' | 'enum' | 'object' | 'array'
  required: boolean
  nullable: boolean
  enum?: readonly string[]
  textLimit?: keyof typeof TOOL_TEXT_LIMITS   // opcional, liga ao limite
  description?: string
}

type ToolDescriptor = {
  name: string
  description: string
  friendlyName: string
  namespace: 'discovery' | 'planning' | 'mutation'
  fields: ToolField[]
  routing?: Partial<ToolRoutingMetadata>   // quando não derivável
  policy: McpPolicy
}
```

Schema, `required`, validação e routing são **funções puras** sobre esse descritor.

- **Por que:** centraliza a edição; a lista de campos já existe conceitualmente em `fieldsByTool`, só que separada de `required` e do tipo.
- **Alternativa descartada:** gerar código a partir de um JSON externo — mais indireção e mais um artefato para manter sincronizado, sem ganho sobre uma estrutura tipada em TS.

### 2. `validation.ts` consome o descritor, não uma tabela própria

`validateToolArguments` passa a obter obrigatórios e limites de `toolFieldFor(name)`/`requiredFieldsFor(name)` do registry. As funções `assert*` continuam (são boas mensagens de erro) e ganham os limites vindos do descritor.

- **Por que:** acaba com a divergência `requiredByTool` × `required`.
- **Alternativa descartada:** deixar `validation.ts` como está e só gerar o schema a partir dele — inverteria a dependência e manteria duas listas.

### 3. Routing declarado ou derivado deterministicamente

`routingFor` deixa de usar conjuntos de nomes. O descritor declara domain/scope/operation/risk (ou uma base de classificação da qual os demais derivam), e `dependencyTools`/`supportedScreens` são calculados por regras puras a partir de `scope`/`operation`.

- **Por que:** renomear uma ferramenta não exige atualizar listas paralelas.
- **Alternativa descartada:** manter os sets e adicionar um teste que verifica pertencimento — reduz o risco mas não elimina a duplicação.

### 4. Limites de texto referenciados, não re-tabelados

`TOOL_TEXT_LIMITS` permanece como constantes (são compartilhadas com os schemas da API), mas cada campo de texto do descritor **referencia** o limite por chave. O validador lê o limite do campo.

- **Por que:** evita `description` ter limite declarado no texto do schema e outro no validador.

### 5. Garantias verificáveis no CI

Expandir `scripts/check-mcp-catalog.ts` com testes de contrato:
- Toda ferramenta de `SHARED_TOOL_NAMES` tem descritor, policy e executor; nenhum descritor sem executor.
- `validateToolArguments` rejeita/serva exatamente conforme o `required` do schema exposto.
- Nenhum arquivo do MCP mantém `Record<string, string[]>` de obrigatórios fora do descritor (checagem de fonte).
- Campos de texto declaram limite; limites documentados coincidem com os usados.
- A checagem de "sem código morto": ausência de ramos `false ?`, `if (false)` e switch pós-`return` nos arquivos do MCP.

- **Por que:** a análise reclama de código que "não executa mas parece autoritativo"; o gate precisa detectar a reintrodução.
- **Alternativa descartada:** confiar só em revisão de PR — foi insuficiente até aqui.

### 6. Compatibilidade observável

Antes de refatorar, capturar o catálogo atual (`getSharedToolDefinitions()` + `withOptionalFields`) em um teste de snapshot e usá-lo como baseline. A refatoração deve manter o snapshot idêntico, exceto pelas divergências corrigidas, que devem ser listadas e justificadas no PR.

## Risks / Trade-offs

- **Regressão silenciosa no schema exposto** → snapshot baseline antes de mexer; qualquer diferença precisa ser intencional e documentada.
- **Correção de divergência muda comportamento** (ex.: passar a exigir um campo que a validação não exigia) → tratar as divergências atuais como decisão explícita no PR: alinhar a validação ao schema exposto, que é o contrato que o cliente vê.
- **`executeSharedTool` com switch de 60 casos** → fora do escopo reorganizá-lo, mas o gate deve garantir que todo nome tem caso; a fonte de verdade de obrigatórios/routing não depende do switch.
- **`index.ts` remonta schema** → manter as funções de exposição (`withOptionalFields`/`withOptionalProjectId`) mas consumindo o schema derivado; elas não reintroduzem tabelas de obrigatórios.
- **Muitos consumidores** (`apps/api`) importam tipos e funções do registry → manter assinaturas públicas (`getSharedToolDefinitions`, `requiredFieldsFor`, `executeSharedTool`, tipos) estáveis.
- **Arquivo `registry.ts` grande** → aceitável nesta entrega; dividir em módulos internos pode ser feito depois, mantendo o descritor como fonte.
