---
title: Mostrar Projetos Ocultos
type: guide
order: 3
---

# Mostrar Projetos Ocultos

Projetos marcados como **Oculto** não aparecem na listagem de projetos. Para enxergá-los, é preciso ligar a preferência **Mostrar projetos ocultos**, disponível no menu do avatar e na página **Minha conta**.

## Onde ligar

Há dois caminhos equivalentes, ambos com o mesmo controle:

1. **Menu do avatar:** selecione a foto no cabeçalho e acione **Mostrar projetos ocultos**.
2. **Página Minha conta:** abra **Configurações da conta** e use o mesmo controle na seção **Visibilidade do projeto**.

Ao alternar o controle, a lista de projetos é recarregada imediatamente, passando a incluir (ou a remover) os projetos ocultos.

## Duração da preferência

A preferência vale **somente para a sessão atual**. Ela:

- sobrevive a recarregamentos da página (F5) enquanto a sessão estiver aberta;
- **volta a ser desligada em todo login**, sem exceção;
- não é salva na conta nem sincronizada entre dispositivos;
- não é compartilhada com outro usuário que autentique no mesmo navegador.

Ou seja: depois de ligar a preferência, ela permanece ativa até o próximo login — e não além disso.

## O que a preferência faz e o que não faz

A preferência apenas revela projetos ocultos na listagem. Ela **não**:

- revela projetos **restritos** dos quais você não participa;
- concede acesso a projetos ocultos de outros tenants;
- altera as permissões dentro do projeto;
- substitui o escopo de projetos de uma API Key.

## Funcionalidades relacionadas

- [[02 - Projetos/Visibilidade de um Projeto|Visibilidade de um projeto]]
- [[02 - Projetos/Consultar e Abrir Projetos|Consultar e abrir projetos]]
- [[08 - Conta e Preferencias/Acessar e Consultar a Conta|Acessar e consultar a conta]]

<details>
<summary><strong>Como funciona tecnicamente</strong></summary>

O estado é guardado na chave `show-hidden-projects` do `sessionStorage`, e não no `localStorage` ou no banco de dados. Isso garante que a preferência sobreviva a recarregamentos da mesma sessão, mas não chegue ao login seguinte.

O `AuthContext` é a única fonte de verdade em execução e zera o valor tanto no login quanto no logout. Quando a preferência está ligada, o frontend solicita a listagem com `includeHidden=true`; caso contrário, o parâmetro é omitido e o backend já exclui os projetos ocultos da resposta.

Se o navegador bloquear o acesso ao armazenamento de sessão, a preferência continua funcionando em memória durante a sessão, sem exibir erros.

</details>
