---
title: Histórico de Atividades e Tempo Trabalhado
type: guide
order: 6
---

# Histórico de Atividades e Tempo Trabalhado

O histórico registra mudanças automáticas e relatos manuais de execução. Ele permite reconstruir o que aconteceu no item e consolidar o tempo informado pela equipe.

## Onde encontrar

1. Abra uma task ou bug existente.
2. Selecione **Histórico**.
3. Uma submodal é aberta sobre o item.

Se existirem registros manuais com duração, o total trabalhado aparece ao lado da ação de histórico na modal principal.

## Logs automáticos

O sistema cria registros para mudanças relevantes, como:

- Alteração de título ou descrição.
- Mudança de prioridade.
- Troca de responsável.
- Atualização de pontos e datas.
- Mudança de status.
- Movimentação entre colunas.

Um log automático mostra o autor da ação, data, hora e descrição. Ele não pode ser editado.

## Registrar uma atividade manual

1. Abra o histórico.
2. Selecione **Registrar atividade**.
3. Descreva o trabalho realizado.
4. Informe a duração em minutos, se aplicável.
5. Selecione **Salvar**.

A duração é opcional. Registros sem duração continuam fazendo parte do histórico, mas não contribuem para o total trabalhado.

## Escrever um bom registro

Prefira descrições que expliquem resultado e contexto:

```text
Mapeados os códigos de erro do gateway e adicionados testes para recusas.
```

Evite registros vagos:

```text
Trabalhei no card.
```

## Editar um registro manual

1. Localize um registro criado por você.
2. Selecione a ação de edição.
3. Altere descrição ou duração.
4. Salve.

Administradores podem editar registros manuais de qualquer membro. Membros não podem editar registros de outras pessoas.

## Total trabalhado

O total soma as durações dos logs manuais:

- Menos de uma hora: `45min trabalhadas`.
- Horas inteiras: `2h trabalhadas`.
- Horas e minutos: `3h 30min trabalhadas`.

Quando nenhuma duração foi registrada, o total não é exibido.

## Consultar históricos extensos

Os registros mais recentes aparecem primeiro. Quando existem mais de 20, use **Carregar mais** para consultar páginas anteriores.

## Fechar o histórico

Selecione o controle de fechamento, clique fora ou pressione `Escape`. A modal do item volta ao foco sem ser recarregada.

## Regras e comportamentos

- Logs automáticos não são editáveis.
- Descrição é obrigatória em logs manuais.
- Duração é opcional e registrada em minutos.
- O total considera somente registros manuais com duração.
- Histórico acompanha o item durante arquivamento e restauração.
- Excluir o item remove seu histórico.

## Permissões

| Ação | Admin | Membro | Visualizador |
|---|---:|---:|---:|
| Consultar histórico | Sim | Sim | Sim |
| Registrar atividade | Sim | Sim | Não |
| Editar registro próprio | Sim | Sim | Não |
| Editar registro de outro | Sim | Não | Não |
| Editar log automático | Não | Não | Não |

## Funcionalidades relacionadas

- [[06 - Tasks Bugs e Subtasks/Criar e Editar Tasks e Bugs|Criar e editar tasks e bugs]]
- [[06 - Tasks Bugs e Subtasks/Checklists|Checklists]]
- [[04 - Board e Visualizacoes/Sincronizacao em Tempo Real|Sincronização em tempo real]]

<details>
<summary><strong>Como funciona tecnicamente</strong></summary>

### Tipos de log

Cada registro possui tipo `auto` ou `manual`, autor opcional, texto, duração opcional e timestamps. Logs automáticos são produzidos pela lógica de atualização e movimentação.

### Autorização

A edição valida se o log é manual e se o solicitante é seu autor ou `Admin`. A leitura exige acesso de visualização ao projeto.

### Paginação e total

A consulta retorna registros em ordem decrescente com total e página. O frontend soma `durationMin` dos logs manuais para apresentar o tempo trabalhado.

</details>

