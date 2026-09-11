---
title: Gerenciar API Keys
type: guide
order: 3
---

# Gerenciar API Keys

Uma API Key é uma credencial pessoal para autenticar agentes de IA, clientes MCP e outras integrações no Azy Board. Cada chave identifica seu proprietário e atua dentro das permissões que essa pessoa possui.

> [!danger] Trate a chave como uma senha
> Quem obtiver o segredo poderá tentar operar em nome do proprietário. Nunca publique a chave em repositórios, mensagens, documentação ou logs.

## Onde encontrar

1. Abra o menu do avatar.
2. Selecione **Configurações da conta**.
3. Localize a seção **API Keys**.

Quando nenhuma chave existe, a página apresenta um estado vazio e a ação para criar a primeira.

## Criar uma chave

1. Selecione **Nova API Key**.
2. Informe um nome obrigatório.
3. Opcionalmente, informe o modelo de IA.
4. Confirme a criação.

Use um nome que identifique o cliente e o ambiente, por exemplo `Claude Code - notebook` ou `Agente de triagem - produção`. O modelo é metadado de identificação e não altera sozinho as permissões da chave.

## Copiar o segredo

Após a criação, uma janela apresenta o valor completo:

1. Selecione o ícone de cópia.
2. Armazene o segredo em um gerenciador de credenciais ou variável de ambiente.
3. Selecione **Já copiei**.

O valor integral aparece apenas nesse momento. Depois que a janela é fechada, ele não pode ser consultado novamente.

> [!warning] Chave perdida
> Se o segredo não foi guardado, revogue a chave e crie outra. O sistema não consegue recuperar o valor original.

## Consultar as chaves

Cada registro da lista apresenta:

| Informação | Uso |
|---|---|
| Nome | Identificar cliente, finalidade ou ambiente. |
| Modelo de IA | Identificar o agente ou modelo associado, quando informado. |
| Criada em | Acompanhar a idade da credencial. |
| Último uso | Identificar atividade recente ou indicar **Nunca utilizada**. |

A listagem nunca apresenta o segredo completo.

## Usar com segurança

- Armazene em um cofre de segredos ou variável de ambiente.
- Crie chaves separadas para cada agente, dispositivo ou ambiente.
- Não reutilize a mesma credencial entre desenvolvimento e produção.
- Revogue chaves sem uso ou de dispositivos perdidos.
- Analise a data do último uso para identificar credenciais esquecidas.
- Aplique rotação periódica conforme a política da organização.

## Revogar uma chave

1. Selecione o ícone de revogação na chave desejada.
2. Confira o nome apresentado.
3. Confirme em **Revogar**.

A revogação interrompe novas autenticações com aquele segredo e não pode ser desfeita pela interface. Cancelar a confirmação mantém a chave ativa.

## Escopo e permissões

- Uma chave pertence somente à conta que a criou.
- Ela opera no tenant do proprietário.
- O acesso a um projeto depende da associação do proprietário ao projeto.
- As operações continuam sujeitas ao papel e às regras da funcionalidade.
- Uma pessoa não pode listar nem revogar chaves de outra conta.

Além da herança, a API suporta restrições opcionais por chave: limite a projetos específicos (`projectScope`), limite de permissões (`permissionScope`, com os valores `read`, `write`, `admin` e `delete`) e data de expiração (`expiresAt`). Esses campos apenas restringem o acesso herdado do proprietário — nunca o ampliam. A tela atual expõe nome e modelo do agente; os demais campos podem ser usados por integrações via API.

## Em caso de exposição

1. Revogue a chave imediatamente.
2. Remova o segredo do local exposto e de seu histórico, quando possível.
3. Crie uma nova chave com nome que indique a substituição.
4. Atualize apenas os clientes autorizados.
5. Verifique os registros e a data de último uso.

## Funcionalidades relacionadas

- [[08 - Conta e Preferencias/Acessar e Consultar a Conta|Acessar e consultar a conta]]
- [[09 - Agentes e Integracoes/Agentes e Integracoes|Agentes e integrações]]
- [[10 - Referencia/Perfis e Permissoes|Perfis e permissões]]

<details>
<summary><strong>Como funciona tecnicamente</strong></summary>

Na criação, o backend gera um segredo aleatório e persiste somente seu hash SHA-256 junto ao proprietário, tenant, nome, modelo opcional e datas de auditoria. O segredo em texto aparece apenas na resposta de criação.

A listagem filtra por `tenantId + ownerId` e retorna metadados, nunca o hash ou o segredo. A revogação aplica o mesmo filtro; uma tentativa de remover uma chave alheia recebe resposta de não encontrado, sem revelar sua existência.

Durante a autenticação, o segredo apresentado é transformado em hash e comparado ao valor armazenado. O contexto resultante conserva usuário e tenant para que as rotas de projeto ainda apliquem associação e RBAC.

</details>

