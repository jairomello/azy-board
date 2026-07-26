---
title: Ler e Atualizar o Board com Shadow Markdown
type: guide
order: 3
---

# Ler e Atualizar o Board com Shadow Markdown

Shadow Markdown é uma representação textual do Board destinada a agentes e automações. Ela permite compreender colunas e cards sem interpretar a interface visual e aplicar alterações enviando o documento editado.

## Quando usar

Use Shadow Markdown quando o agente precisa:

- ler o Board inteiro em um formato compacto;
- raciocinar sobre a distribuição do trabalho por coluna;
- mover vários cards em uma única edição textual;
- trabalhar com uma interface baseada em documentos.

Para operações pontuais e validadas por ação, prefira as [[09 - Agentes e Integracoes/Usar as Ferramentas MCP|ferramentas MCP]] ou a API REST.

## Consultar o documento

Faça uma leitura autenticada de:

```text
GET /api/projects/{projectId}/board.md
```

A resposta usa `text/markdown` e segue esta estrutura:

```markdown
# Board - Sprint: Sprint 12 (2026-07-01 -> 2026-07-15)

## A Fazer
- [ ] #01abcd23: Preparar migration @unassigned [HIGH] [3pts] {backend}

## Em desenvolvimento
- [/] #09ef4567: Implementar endpoint @Agente API [MEDIUM] [BUG]

## Concluido
- [x] #0789abcd: Validar contrato @Jairo [LOW]
```

## Interpretar uma linha

| Trecho | Significado |
|---|---|
| `[ ]` | Item ainda não iniciado. |
| `[/]` | Item em andamento. |
| `[x]` | Item concluído. |
| `#01abcd23` | Âncora derivada do identificador do item. |
| `@unassigned` | Sem responsável. |
| `[HIGH]` | Prioridade. |
| `[BUG]` | Indica explicitamente um bug; a ausência representa task. |
| `[3pts]` | Estimativa, quando informada. |
| `{backend}` | Tags associadas. |

O cabeçalho informa a sprint ativa ou **Sem sprint ativa**. Cada título de nível 2 corresponde ao nome exato de uma coluna.

## Atualizar pelo documento

1. Consulte a versão mais recente com `GET`.
2. Preserve os identificadores dos cards.
3. Mova a linha completa para a seção da coluna desejada.
4. Ajuste somente os campos suportados.
5. Envie o documento completo com:

```text
PATCH /api/projects/{projectId}/board.md
Content-Type: text/markdown
```

O sistema compara o documento recebido com o estado persistido e executa as mudanças identificadas.

## Identificação por ID

O identificador após `#` é a âncora do card. O sistema não depende do título para reconhecer o item. Isso permite corrigir um título sem confundir cards com nomes parecidos.

Nunca troque, reutilize ou invente uma âncora. Para criar um item novo, use MCP ou REST e consulte novamente o documento.

## Movimentar cards

Para mover um card, retire sua linha da coluna atual e coloque-a abaixo do cabeçalho da coluna de destino. O nome do cabeçalho precisa corresponder a uma coluna real.

Uma movimentação atualiza também o status base do item e é propagada ao Board em tempo real.

## Validação e conflitos

Se o documento contiver uma coluna inexistente, identificador desconhecido, estrutura ambígua ou alteração incompatível, a API responde com erro `422` e uma lista de inconsistências.

Corrija os problemas e envie novamente o documento completo. Não presuma que linhas sem identificador criam cards.

## Cuidados ao editar

- Sempre comece por uma leitura recente.
- Preserve cabeçalhos, IDs e o formato das linhas.
- Evite editar simultaneamente uma cópia antiga e o Board visual.
- Consulte novamente após uma atualização para confirmar o resultado.
- Prefira MCP para operações que exigem validação hierárquica detalhada.

## Permissões

| Ação | Admin | Membro | Visualizador |
|---|---:|---:|---:|
| Ler o Shadow Markdown | Sim | Sim | Sim |
| Enviar alterações | Sim | Sim | Não |

## Funcionalidades relacionadas

- [[04 - Board e Visualizacoes/Swimlanes e Colunas|Swimlanes e colunas]]
- [[04 - Board e Visualizacoes/Criar Mover e Ordenar Cards|Criar, mover e ordenar cards]]
- [[09 - Agentes e Integracoes/Integrar pela API REST e Autenticar Agentes|Integrar pela API REST e autenticar agentes]]
- [[09 - Agentes e Integracoes/Entender a Sincronizacao e Auditoria|Entender a sincronização e auditoria]]

<details>
<summary><strong>Como funciona tecnicamente</strong></summary>

O `GET` consulta colunas ordenadas, sprint ativa, itens, responsáveis e tags no tenant e projeto autenticados. Somente `TASK` e `BUG` com coluna são serializados na visão do Board.

O `PATCH` recebe o Markdown completo, percorre cabeçalhos e linhas, resolve cada âncora no projeto e calcula as diferenças. Alterações válidas são convertidas em atualizações de recursos; inconsistências são agregadas antes da resposta `422`. Movimentações emitem `CARD_MOVED` pelo WebSocket.

</details>

