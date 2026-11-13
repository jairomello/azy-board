# Design — criar card pelo Teams

## Contexto

O Teams oferece três formas de receber mensagem de um canal:

| Caminho | Menção real | Azure AD | Complexidade | Decisão |
|---|---|---|---|---|
| **Outgoing webhook** | Sim (`@Azy`) | Não | Baixa | **Escolhido** |
| Power Automate / Workflows | Não (reage a palavra) | Não | Média | Plano B se o tenant bloquear |
| Bot Framework | Sim | Sim | Alta | Fora da v1 |

O outgoing webhook é criado **por time** e aponta para uma URL HTTPS nossa. O Teams assina cada requisição com HMAC-SHA256 usando o token gerado na criação.

## Fluxo

```text
@Azy criar ajustar X, Y e Z na camada W
        │
        ▼
Teams  ──POST──▶  /api/integrations/teams/messages/<token público>
                     │ 1. resolve integração pelo token
                     │ 2. valida HMAC com o segredo do Teams
                     │ 3. dedup pelo id da mensagem
                     │ 4. interpreta o comando
                     │ 5. cria o card
                     ▼
                  resposta JSON com o link do card
        ◀─────────┘
Teams mostra a resposta na thread
```

## Identificação e configuração

O endpoint precisa saber **qual projeto** criar o card. Como o webhook é por time e o Teams só envia o payload, a URL carrega um **token público aleatório** (`/messages/<token>`), que resolve a integração no banco. O segredo do Teams fica só no servidor e nunca aparece na URL.

Configuração (ADMIN):

- token público gerado pelo Azy (usado na URL);
- segredo do Teams (colado pelo ADMIN);
- tipo padrão (TASK) e coluna inicial (configurável, padrão `NOT_STARTED`);
- ativo/inativo;
- últimas mensagens recebidas com resultado.

## Comando

```text
@Azy criar <título> [| tipo: BUG] [| prazo: DD/MM/AAAA] [| responsável: Nome]
```

- A menção (`<at>Azy</at>`) é removida antes do parse.
- Sem `criar`, a mensagem é ignorada com resposta explicando o formato.
- Título vazio ou acima de 200 caracteres é recusado com erro claro.
- Campos desconhecidos são ignorados e informados na resposta.

## Criação do card

- Tipo padrão `TASK`; `BUG` quando informado.
- Coluna inicial configurada (padrão `NOT_STARTED`).
- `externalSource = 'TEAMS'` e `externalRef = <id da mensagem>` para rastrear a origem.
- Autor: `assigneeLabel` com o nome exibido no Teams (o payload não traz e-mail). O nome do remetente também entra no log do card.
- Prioridade padrão `MEDIUM`.

## Confiabilidade

- **Dedup** por `(integration_id, teams_message_id)`: o Teams pode reenviar a mesma mensagem; a segunda chamada devolve o mesmo card.
- **Resposta rápida**: o Teams espera resposta em poucos segundos; a criação é local e rápida, sem chamadas externas.
- **Rate limit** por integração (ex.: 30 mensagens/minuto) para evitar abuso do endpoint público.
- **Falha na criação**: resposta com erro legível na thread; nada é criado pela metade.

## Segurança

- HMAC obrigatório: `Authorization: HMAC <base64(hmac-sha256(body, base64decode(secret)))>`.
- Token público com alta entropia; rotação disponível na configuração.
- Endpoint responde 404 para token desconhecido ou integração inativa, sem revelar detalhes.
- Nenhum dado de outro tenant é acessível: a integração determina tenant e projeto.
- Corpo limitado (ex.: 32 KB) e apenas `application/json`.

## Riscos

- **Tenant bloqueia outgoing webhooks**: plano B é um fluxo do Power Automate chamando o mesmo endpoint (o contrato do endpoint não muda).
- **Sem e-mail do autor**: o card nasce com responsável externo; mapear por Graph exige permissão adicional.
- **Mudança de contrato**: nova tabela exige migration SQLite e PostgreSQL no mesmo PR.
