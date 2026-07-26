---
title: Configurar Tema e Idioma
type: guide
order: 2
---

# Configurar Tema e Idioma

Tema e idioma são preferências pessoais de experiência. Seus controles aparecem no cabeçalho das principais telas e na página **Minha conta**.

## Alternar o tema

Selecione o botão de tema no cabeçalho:

- no tema claro, o ícone permite ativar o modo escuro;
- no tema escuro, o ícone permite retornar ao modo claro.

A mudança é aplicada imediatamente a toda a interface, incluindo Board, modais, menus, formulários e páginas de configuração.

## Tema usado na primeira visita

Quando o navegador ainda não possui uma preferência do Azy Board, a aplicação consulta o tema claro ou escuro configurado no sistema operacional e o usa como ponto de partida.

Depois dessa escolha inicial, o tema passa a ser controlado explicitamente pelo botão. Mudanças posteriores no tema do sistema operacional não substituem a preferência salva.

## Escolher o idioma

Use o seletor compacto no cabeçalho:

| Opção | Idioma |
|---|---|
| `PT` | Português do Brasil (`pt-BR`). |
| `EN` | Inglês (`en`). |
| `ES` | Espanhol (`es`). |

Ao selecionar uma opção, os textos traduzidos são atualizados imediatamente. Nomes de projetos, módulos, cards e demais conteúdos criados pelos usuários não são traduzidos.

## Persistência das preferências

Tema e idioma são salvos em dois níveis:

1. **Navegador:** permite aplicar a preferência já na abertura da página.
2. **Conta:** permite recuperar a escolha autenticada e sincronizá-la entre dispositivos.

O salvamento local evita que a tela apareça brevemente no tema incorreto durante o carregamento.

## Comportamento sem conexão

A interface aplica a alteração localmente mesmo antes da confirmação remota. Se o perfil não puder ser atualizado naquele momento, a preferência continua funcionando no navegador atual e pode ser sincronizada em uma tentativa posterior.

## Idioma não traduzido ou incompleto

Quando uma chave de tradução não existe no idioma selecionado, a aplicação usa português do Brasil como idioma de fallback. Termos técnicos convencionais, como `Board`, `sprint`, `bug` e `API Key`, podem permanecer em inglês.

## Funcionalidades relacionadas

- [[08 - Conta e Preferencias/Acessar e Consultar a Conta|Acessar e consultar a conta]]
- [[01 - Acesso e Navegacao/Navegacao Global|Navegação global]]

<details>
<summary><strong>Como funciona tecnicamente</strong></summary>

O tema é representado por `light` ou `dark`. Antes do primeiro render, a aplicação lê `localStorage['theme']`; se não houver valor, consulta `prefers-color-scheme` e persiste o resultado. O modo escuro é aplicado pela classe `dark` no elemento raiz.

O idioma usa `i18next` com detecção por `localStorage['language']` e, na ausência, pelo navegador. Os recursos são separados por namespaces e possuem `pt-BR` como fallback. Alterações autenticadas também atualizam os campos de preferência do usuário no backend.

</details>
