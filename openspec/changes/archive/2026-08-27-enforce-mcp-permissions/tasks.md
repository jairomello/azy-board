## 1. Autorização Compartilhada

- [x] 1.1 Mapear todas as ferramentas MCP registradas e associar cada uma ao nível mínimo global e ao papel local exigido.
- [x] 1.2 Extrair ou adaptar predicados compartilhados de grupo global, membership, tenant e escopo de API Key para uso pela API REST e pelo MCP.
- [x] 1.3 Implementar resolução server-side do Owner da API Key com validação de hash, tenant, grupo persistido, revogação e expiração.
- [x] 1.4 Implementar fail closed para grupo inválido, Owner ausente, tenant inconsistente, escopo inválido e ferramenta sem política declarada.

## 2. Middleware E Escopo MCP

- [x] 2.1 Integrar o contexto efetivo do Owner ao transporte stdio e aos handlers MCP sem aceitar grupo, Owner ou tenant do payload.
- [x] 2.2 Aplicar a interseção entre permissões do Owner e `projectScope`/`permissionScope` da API Key em toda chamada.
- [x] 2.3 Revalidar API Key, Owner, grupo, tenant, escopos e autorização do recurso em cada chamada de ferramenta.
- [x] 2.4 Garantir que leituras, resoluções de nome, contagens e chamadas downstream ocorram somente depois da autorização.
- [x] 2.5 Padronizar erros MCP seguros, com código estável, sem vazamento de recursos e retry somente para falhas transitórias.

## 3. Ferramentas E Regras De Negócio

- [x] 3.1 Ajustar `list_projects`, `get_project` e `get_board` para respeitar escopo do grupo, membership, tenant e API Key.
- [x] 3.2 Ajustar ferramentas de conteúdo (`list_tasks`, `create_task`, `claim_task`, `move_task`, `complete_task` e equivalentes) para aplicar o papel local efetivo.
- [x] 3.3 Proteger ferramentas de criação de projetos, configurações, módulos, colunas, sprints, tags, versões, membros, squads e centros de custo conforme a política do Owner.
- [x] 3.4 Garantir que operações não suportadas, como upload via IA, permaneçam explicitamente bloqueadas sem persistência.
- [x] 3.5 Garantir que nenhum handler permita alterar o Owner, tenant, grupo, membership efetiva ou escopo da chave por parâmetros da ferramenta.

## 4. Testes De Segurança E Regressão

- [x] 4.1 Adicionar testes de unidade para herança de grupo, interseção de escopos, precedência e fail closed.
- [x] 4.2 Adicionar testes MCP para Membro de Equipe, Gerente, Admin e Root cobrindo leituras e mutações permitidas e proibidas.
- [x] 4.3 Adicionar testes de isolamento cross-tenant, membership ausente, IDs forjados, grupo/papel forjado e API Key com escopo conflitante.
- [x] 4.4 Adicionar testes de revogação de chave e alteração de grupo com sessão MCP já iniciada.
- [x] 4.5 Manter a suíte `bun run test:mcp` independente de servidor externo, banco real e credenciais reais.

## 5. Verificação E Documentação

- [x] 5.1 Atualizar README/catalogo MCP para documentar autenticação, herança de permissões e níveis mínimos das ferramentas.
- [x] 5.2 Verificar que cada ferramenta do catálogo possui uma política de autorização testada.
- [x] 5.3 Executar typecheck strict, lint, testes da API, `bun run test:mcp` e build.
- [x] 5.4 Revisar logs e respostas para garantir que segredos, IDs e dados fora do escopo não sejam expostos.
