---
title: Entrar e Manter a Sessão
type: guide
order: 1
---

# Entrar e Manter a Sessão

O acesso ao Azy Board começa pela tela de login. A autenticação identifica a pessoa, sua organização e os projetos aos quais ela pode acessar.

## Onde encontrar

A tela de login é apresentada quando:

- A aplicação é acessada sem uma sessão válida.
- A pessoa tenta abrir diretamente uma área protegida.
- A sessão anterior expirou.
- A pessoa encerrou sua sessão.

## Visão da tela

A tela contém:

- Identificação visual do Azy Board.
- Campo **E-mail**.
- Campo **Senha**.
- Botão para entrar.
- Área de mensagem para credenciais inválidas.

Não existe cadastro público de usuários nessa tela. O acesso é concedido por meio do processo de administração da organização.

## Como entrar

1. Informe o e-mail associado à sua conta.
2. Digite sua senha.
3. Selecione o botão de entrada.
4. Aguarde a abertura da lista de projetos.

Quando o login é iniciado a partir de um link protegido, a aplicação pode retornar à área originalmente solicitada depois da autenticação.

## Credenciais inválidas

Quando o e-mail não existe ou a senha está incorreta, a aplicação apresenta uma mensagem genérica de credenciais inválidas.

> [!info] Proteção da conta
> A mensagem não informa se foi o e-mail ou a senha que falhou. Isso evita revelar a existência de contas a terceiros.

Para tentar novamente:

1. Confira se o e-mail foi digitado por completo.
2. Verifique a senha e o estado das teclas de maiúsculas.
3. Envie o formulário novamente.

## Sessão existente

Ao abrir ou recarregar a aplicação, uma sessão ainda válida é reconhecida automaticamente. Durante essa verificação, a aplicação apresenta um indicador de carregamento e só depois libera a área protegida.

A sessão carrega as seguintes informações da conta:

- Identificador do usuário.
- Nome e e-mail.
- Avatar, quando configurado.
- Tema preferido.
- Idioma preferido.

## Encerrar a sessão

1. Selecione seu avatar no cabeçalho.
2. Escolha **Sair**.
3. A sessão é encerrada e as áreas protegidas deixam de ficar disponíveis.

Encerrar a sessão não remove preferências locais nem altera projetos ou itens.

## Regras e comportamentos

- E-mail e senha são obrigatórios.
- Cada sessão pertence a uma única conta e organização.
- Somente projetos associados à conta autenticada são apresentados.
- Abrir uma rota protegida sem autenticação leva à tela de login.
- Uma sessão expirada exige nova autenticação.
- Sair da aplicação invalida a sessão atual no navegador.

## Permissões

O login não depende do papel no projeto. Depois da autenticação, as ações disponíveis são determinadas individualmente em cada projeto.

| Situação | Resultado |
|---|---|
| Conta válida | Acesso à lista de projetos permitidos. |
| Conta válida sem projetos | Acesso à lista vazia e à criação de projeto. |
| Credenciais inválidas | Permanência na tela de login. |
| Sessão ausente ou expirada | Redirecionamento para autenticação. |

## Exemplo prático

Uma pessoa recebe uma conta da organização e participa de dois projetos. Depois do login, ela visualiza somente esses dois projetos. Mesmo que conheça o endereço de outro projeto, o acesso depende de uma associação válida.

## Funcionalidades relacionadas

- [[01 - Acesso e Navegacao/Navegacao Global|Navegação global]]
- [[02 - Projetos/Consultar e Abrir Projetos|Consultar e abrir projetos]]
- [[10 - Referencia/Perfis e Permissoes|Perfis e permissões]]

<details>
<summary><strong>Como funciona tecnicamente</strong></summary>

### Autenticação

O frontend envia e-mail e senha ao serviço de autenticação. O backend localiza a conta, compara a senha com o hash armazenado e retorna os dados públicos do usuário.

Uma autenticação bem-sucedida cria um token de sessão com identificador do usuário, tenant, e-mail e validade. O token é armazenado em cookie `HttpOnly`, indisponível para scripts da página.

### Restauração da sessão

Ao iniciar, o contexto de autenticação consulta a identidade da sessão atual. Enquanto a consulta não termina, rotas protegidas permanecem em estado de carregamento. Sem identidade válida, a navegação é direcionada ao login.

### Segurança

O tenant é obtido do token assinado, não de dados enviados livremente pela interface. Depois da autenticação, as rotas de projeto ainda verificam a membership e o papel exigido por cada operação.

</details>

