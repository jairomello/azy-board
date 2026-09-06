---
title: Integrar pela API REST e Autenticar Agentes
type: guide
order: 4
---

# Integrar pela API REST e Autenticar Agentes

A API REST permite integrar scripts, serviços e agentes diretamente ao Azy Board. Ela oferece os mesmos recursos centrais usados pela interface e pelo servidor MCP.

## Escolher o caminho de integração

| Caminho | Indicado para |
|---|---|
| MCP | Agentes em clientes compatíveis que trabalham por ferramentas. |
| REST | Serviços, scripts e integrações com controle explícito das requisições. |
| Shadow Markdown | Agentes que raciocinam melhor sobre um documento completo do Board. |
| WebSocket | Receber eventos; não substitui REST para executar mutações. |

## Preparar a autenticação

1. Crie uma chave em **Minha conta**.
2. Armazene o segredo com segurança.
3. Envie-o em cada requisição:

```http
Authorization: Bearer azb_sua_chave_aqui
```

Para corpos JSON, inclua:

```http
Content-Type: application/json
```

## URL base

Os recursos protegidos ficam sob:

```text
{URL_DO_AZY_BOARD}/api
```

Exemplo de consulta dos módulos:

```bash
curl \
  -H "Authorization: Bearer $EASYBOARD_API_KEY" \
  "$EASYBOARD_URL/api/projects/$PROJECT_ID/modules"
```

Use variáveis de ambiente para evitar que segredos fiquem gravados no histórico do shell ou em arquivos.

## Recursos principais

| Área | Caminho funcional |
|---|---|
| Projetos | `/projects` e `/projects/{projectId}` |
| Módulos e membros | `/projects/{projectId}/modules`, `/members`, `/squads` |
| Colunas e sprints | `/projects/{projectId}/columns`, `/sprints` |
| Itens | `/projects/{projectId}/items` |
| Checklists | `/projects/{projectId}/items/{itemId}/checklists` |
| Tags e versões | `/projects/{projectId}/tags`, `/versions` |
| Dashboard | `/projects/{projectId}/dashboard/snapshot`, `/burnup`, `/aging`, `/hours`, `/sprints` e `/sprints/{cycleId}` |
| Shadow Markdown | `/projects/{projectId}/board.md` |

Antes de criar itens, consulte a hierarquia e os identificadores necessários. A API valida o mesmo modelo funcional usado pela interface.

## Identidade do agente

A API Key pertence a uma conta humana e pode registrar um nome de modelo de IA. Ao autenticar:

- o agente atua no tenant do proprietário;
- operações de projeto usam a associação do proprietário;
- `claim` registra a chave usada e permite identificar o agente no card;
- a chave não recebe privilégios superiores aos do proprietário.

Use uma chave diferente para cada agente para preservar identificação, revogação e auditoria independentes.

## Interpretar respostas

| Código | Significado comum |
|---:|---|
| `200` | Consulta ou alteração concluída. |
| `201` | Recurso criado. |
| `204` | Operação concluída sem corpo de resposta. |
| `400` | Corpo ou parâmetro inválido. |
| `401` | Credencial ausente ou inválida. |
| `403` | Papel insuficiente para a ação. |
| `404` | Recurso não encontrado ou não revelado ao solicitante. |
| `409` | Conflito com o estado atual, como item já reivindicado. |
| `422` | Regra funcional ou documento inconsistente. |

Trate falhas como parte do fluxo. Não repita automaticamente operações de criação sem verificar se a primeira tentativa foi efetivada.

## Rotação e revogação

Ao trocar uma credencial:

1. crie uma nova chave;
2. atualize o cliente autorizado;
3. valide uma operação de leitura;
4. revogue a chave antiga;
5. confirme que o cliente continua funcionando.

Uma chave revogada passa a receber `401` e não pode ser recuperada.

## Segurança e isolamento

- Nunca envie `tenantId` como tentativa de mudar o contexto da chave.
- Não exponha chaves no frontend, repositório ou logs.
- Valide certificados TLS em ambientes remotos.
- Use os menores papéis necessários no projeto.
- Trate `404` como ausência de acesso ou de recurso, sem tentar enumerar IDs.

## Funcionalidades relacionadas

- [[08 - Conta e Preferencias/Gerenciar API Keys|Gerenciar API Keys]]
- [[09 - Agentes e Integracoes/Configurar o Servidor MCP|Configurar o servidor MCP]]
- [[09 - Agentes e Integracoes/Ler e Atualizar o Board com Shadow Markdown|Ler e atualizar o Board com Shadow Markdown]]
- [[10 - Referencia/Perfis e Permissoes|Perfis e permissões]]

<details>
<summary><strong>Como funciona tecnicamente</strong></summary>

O middleware aceita sessão JWT em cookie `HttpOnly` para pessoas ou Bearer API Key para agentes. A chave recebida é transformada em SHA-256 e comparada ao hash persistido; o segredo original não é armazenado.

Depois da autenticação, o contexto contém `userId`, `tenantId` e e-mail. Rotas de projeto consultam a associação por tenant, usuário e projeto e comparam a hierarquia `VIEWER < MEMBER < ADMIN`. A ausência de associação retorna `404` para não revelar projetos externos.

</details>
