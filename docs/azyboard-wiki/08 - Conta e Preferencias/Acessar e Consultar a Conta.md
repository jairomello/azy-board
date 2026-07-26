---
title: Acessar e Consultar a Conta
type: guide
order: 1
---

# Acessar e Consultar a Conta

A área **Minha conta** reúne a identificação da pessoa autenticada, suas preferências e as credenciais pessoais usadas por agentes e integrações.

## Abrir o menu do perfil

Selecione o avatar no cabeçalho da lista de projetos ou do Board. O menu apresenta:

- **Configurações da conta**, para abrir a página pessoal;
- **Sair**, para encerrar a sessão.

Selecione novamente o avatar ou clique fora do menu para fechá-lo.

## Acessar Minha conta

1. Abra o menu do perfil.
2. Selecione **Configurações da conta**.

A rota é protegida e exige uma sessão válida. Se a autenticação tiver expirado, a aplicação direciona para o login.

## Informações do perfil

No início da página são apresentados:

- avatar, quando cadastrado;
- ícone padrão quando não existe avatar;
- nome;
- e-mail da conta.

Esses dados identificam a pessoa em atribuições, membros do projeto e registros de atividade. Nesta área eles são consultivos; alterações cadastrais dependem da administração da conta no ambiente organizacional.

## Voltar aos projetos

Selecione **Projetos** no cabeçalho para retornar ao portfólio. A navegação não encerra a sessão nem altera as preferências.

## Sair da aplicação

1. Abra o menu do perfil.
2. Selecione **Sair**.

A sessão atual é encerrada e a aplicação retorna para o login. Preferências armazenadas no navegador, como tema e idioma, podem continuar disponíveis para a próxima sessão no mesmo dispositivo.

## Conta e projetos

A conta é global para o ambiente, enquanto papéis e squads são definidos por projeto. A mesma pessoa pode participar de vários projetos com permissões diferentes sem precisar de contas separadas.

As API Keys também pertencem à conta. Elas não concedem automaticamente acesso a todos os projetos; as operações continuam sujeitas às associações e permissões do proprietário.

## Funcionalidades relacionadas

- [[01 - Acesso e Navegacao/Entrar e Manter a Sessao|Entrar e manter a sessão]]
- [[01 - Acesso e Navegacao/Navegacao Global|Navegação global]]
- [[08 - Conta e Preferencias/Configurar Tema e Idioma|Configurar tema e idioma]]
- [[08 - Conta e Preferencias/Gerenciar API Keys|Gerenciar API Keys]]
- [[10 - Referencia/Perfis e Permissoes|Perfis e permissões]]

<details>
<summary><strong>Como funciona tecnicamente</strong></summary>

A página `/account` fica atrás da mesma proteção de rota usada nas áreas autenticadas. O contexto de autenticação fornece nome, e-mail, avatar, tema e idioma do usuário atual.

A sessão é mantida em cookie `HttpOnly`. Ao sair, o backend invalida o cookie e o frontend limpa o estado autenticado. O menu fecha ao navegar, ao selecionar uma ação ou ao detectar clique fora de sua área.

</details>
