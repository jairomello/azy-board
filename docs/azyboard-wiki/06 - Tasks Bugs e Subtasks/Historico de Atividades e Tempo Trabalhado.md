---
title: Histórico de Atividades e Tempo Trabalhado
type: guide
order: 6
---

# Histórico de Atividades e Tempo Trabalhado

O item possui dois registros independentes: o **Histórico de alterações** reconstrói mudanças automáticas e o **Diário de trabalho** consolida anotações e tempo informado pela equipe.

## Onde encontrar

1. Abra uma task ou bug existente.
2. Abra o accordion **Histórico** para consultar alterações ou **Diário de trabalho** para lançar horas e anotações.
3. A ação escolhida abre sua própria submodal sobre o item.

As duas seções exibem contagens independentes. Se existirem registros no diário com duração, o total trabalhado aparece na seção do diário.

## Logs automáticos

O sistema cria registros para mudanças relevantes, como:

- Alteração de título ou descrição.
- Mudança de prioridade.
- Troca de responsável.
- Atualização de pontos e datas.
- Mudança de status.
- Movimentação entre colunas.

Um log automático mostra o executor, origem (humano, agente ou sistema), data, hora e descrição. Ele não pode ser editado.

## Registrar trabalho no diário

1. Abra o diário de trabalho.
2. Selecione **Registrar trabalho**.
3. Descreva o trabalho realizado.
4. Informe a duração no formato `H:MM`, por exemplo `2:00`, `8:00`, `29:00` ou `0:50`.
5. Selecione **Salvar**.

A duração pode ser deixada vazia quando o registro for apenas uma anotação. Registros sem duração continuam no diário, mas não contribuem para o total trabalhado.

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
3. Altere descrição ou duração no formato `H:MM`.
4. Salve.

Administradores podem editar registros manuais de qualquer membro. Membros não podem editar registros de outras pessoas.

## Total trabalhado

O total soma as durações dos registros do diário:

- Menos de uma hora: `0:45`.
- Horas inteiras: `2:00`.
- Horas e minutos: `3:30`.

Quando nenhuma duração foi registrada, o total não é exibido.

## Consultar históricos extensos

Os registros mais recentes aparecem primeiro. Quando existem mais de 20, use **Carregar mais** para consultar páginas anteriores.

## Fechar o histórico

Selecione o controle de fechamento, clique fora ou pressione `Escape`. A modal do item volta ao foco sem ser recarregada.

## Regras e comportamentos

- Eventos automáticos não são editáveis nem excluíveis.
- Descrição é obrigatória nos registros do diário.
- Duração usa entrada `H:MM` e é registrada internamente em minutos.
- O total considera somente registros do diário com duração.
- Histórico acompanha o item durante arquivamento e restauração.
- Excluir o item remove seu histórico.

## Permissões

| Ação | Admin | Membro | Visualizador |
|---|---:|---:|---:|
| Consultar histórico e diário | Sim | Sim | Sim |
| Registrar trabalho | Sim | Sim | Não |
| Editar/excluir registro próprio | Sim | Sim | Não |
| Editar/excluir registro de outro | Sim | Não | Não |
| Editar/excluir evento automático | Não | Não | Não |

## Funcionalidades relacionadas

- [[06 - Tasks Bugs e Subtasks/Criar e Editar Tasks e Bugs|Criar e editar tasks e bugs]]
- [[06 - Tasks Bugs e Subtasks/Checklists|Checklists]]
- [[04 - Board e Visualizacoes/Sincronizacao em Tempo Real|Sincronização em tempo real]]

<details>
<summary><strong>Como funciona tecnicamente</strong></summary>

### Tipos de log

Cada registro possui tipo `auto` ou `manual`, autor, origem, identidade do executor, texto, duração opcional e timestamps. Eventos automáticos são produzidos pela lógica de atualização e movimentação; registros manuais pertencem ao diário.

### Autorização

A edição e exclusão validam se o registro é manual e se o solicitante é seu autor ou `Admin`. A leitura exige acesso de visualização ao projeto.

### Paginação e total

A auditoria e o diário possuem consultas separadas, ambas em ordem decrescente com total e página. O diário também retorna a soma de `durationMin` para apresentar o tempo trabalhado.

</details>
