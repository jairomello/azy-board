---
title: Visibilidade de um Projeto
type: guide
order: 5
---

# Visibilidade de um Projeto

Todo projeto possui dois sinalizadores de visibilidade: **Restrito** e **Oculto**. Eles são independentes e controlam quem encontra o projeto ao listar os projetos do workspace.

Por padrão, um projeto novo **não é restrito** e **não é oculto**: ele aparece normalmente para todos, conforme o perfil de cada pessoa.

## Restrito

Um projeto restrito só aparece na listagem para quem tem vínculo com ele:

- membros da equipe do projeto;
- o gerente geral do projeto.

Isso vale **inclusive para administradores e Root**. Uma pessoa com perfil administrativo que não participe do projeto restrito não o vê na lista de cards e também não consegue abri-lo diretamente pela URL, por API Key, MCP ou agente.

## Oculto

Um projeto oculto sai das listagens. Ele continua existindo, com todo o seu conteúdo, mas não aparece entre os cards de projetos.

Para enxergar projetos ocultos, é preciso ligar a preferência **Mostrar projetos ocultos** (ver [[08 - Conta e Preferencias/Mostrar Projetos Ocultos|Mostrar projetos ocultos]]). Essa preferência vale apenas para a sessão atual.

## Combinar os dois sinalizadores

| Restrito | Oculto | Quem vê o projeto |
|---|---|---|
| Não | Não | Todos, conforme o perfil. |
| Sim | Não | Membros e gerente, inclusive administradores com vínculo. |
| Não | Sim | Todos, desde que a preferência "Mostrar projetos ocultos" esteja ligada. |
| Sim | Sim | Somente membros e gerente **com** a preferência ligada. |

Ocultar não é permissão: um projeto oculto e restrito continua fora da listagem de quem não tem vínculo, mesmo com a preferência ligada.

## Onde definir

### Na criação

A janela **Novo projeto** apresenta os dois controles, desligados por padrão, com a explicação de cada comportamento.

### Nas configurações do projeto

A seção **Visibilidade do projeto** exibe o estado atual de **Restrito** e **Oculto** e permite alterá-los a qualquer momento. A alteração é salva imediatamente.

Somente administradores do projeto, gerentes, administradores e Root podem alterar a visibilidade. Membros de Equipe não acessam as configurações do projeto. Para qualquer operação, um projeto restrito exige membership ativa ou indicação como Gerente Geral; o perfil global ADMIN/ROOT não cria exceção.

## Boas práticas

- Use **Restrito** para projetos sensíveis que não devem aparecer para todo o workspace.
- Use **Oculto** para projetos encerrados ou de uso eventual, que poluiriam a lista sem precisar ser excluídos.
- Lembre-se de que ocultar um projeto não impede o acesso de quem é membro dele.

## Funcionalidades relacionadas

- [[02 - Projetos/Criar um Projeto|Criar um projeto]]
- [[02 - Projetos/Consultar e Abrir Projetos|Consultar e abrir projetos]]
- [[08 - Conta e Preferencias/Mostrar Projetos Ocultos|Mostrar projetos ocultos]]
- [[07 - Configuracoes do Projeto/Configuracoes do Projeto|Configurações do Projeto]]

<details>
<summary><strong>Como funciona tecnicamente</strong></summary>

### Persistência

Os sinalizadores ficam nas colunas `is_restricted` e `is_hidden` da tabela de projetos, ambas booleanas com valor padrão `false`. A migração é aditiva, então projetos existentes passam a valer `false` automaticamente, sem backfill.

### Filtragem

A filtragem acontece no servidor, no endpoint de listagem de projetos, sempre dentro do `tenant_id` da sessão. O filtro de restrição é aplicado a qualquer perfil, inclusive administradores; o filtro de ocultos é relaxado somente quando a requisição informa explicitamente `includeHidden=true`.

Como agentes de IA usam o mesmo endpoint, eles herdam exatamente o mesmo escopo da pessoa dona da API Key, respeitando também o escopo de projetos da chave.

</details>
