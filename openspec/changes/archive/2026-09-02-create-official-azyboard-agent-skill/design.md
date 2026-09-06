## Context

O Azy Board possui o servidor MCP em `apps/mcp`, documentação funcional em `docs/` e contratos OpenSpec para MCP, API, permissões, hierarquia e Shadow Markdown. Existem diretórios locais de clientes, mas eles não constituem uma distribuição oficial nem oferecem uma fonte única de instruções. A skill será consumida por code agents com capacidades diferentes, portanto o conteúdo precisa separar conhecimento de domínio, comandos e instruções de instalação.

## Goals / Non-Goals

**Goals:**

- Manter uma fonte canônica da skill em uma pasta neutra e versionada do repositório.
- Orientar o agente a descobrir contexto antes de mutar o board e a respeitar hierarquia, Leaf Rule, permissões, escopos e erros MCP.
- Expor slash commands portáveis, com definição clara de quais clientes podem instalá-los e como os demais podem invocá-los por linguagem natural.
- Documentar configuração do servidor MCP sem versionar credenciais.
- Permitir validar o catálogo de ferramentas e detectar divergência entre a skill e o servidor.

**Non-Goals:**

- Alterar endpoints REST, ferramentas MCP, schemas, políticas de autorização ou comportamento do board.
- Criar um instalador online, marketplace ou pacote publicado nesta mudança.
- Fazer o mesmo arquivo atender diferenças de sintaxe de todos os clientes sem adaptadores.
- Duplicar toda a wiki; a skill deve referenciar documentação detalhada quando necessário.

## Decisions

- **Fonte canônica em `skills/azyboard/`**: usar um diretório público e neutro, com `SKILL.md` como entrada, `references/` para contratos operacionais e `commands/` para comandos. Isso evita acoplamento a `.claude`, `.gemini` ou `.codex`, que têm convenções distintas.
  - Alternativa: manter somente em `.claude/skills/`; descartada por excluir clientes não-Claude e transformar uma integração do produto em configuração local.
- **Instruções orientadas a decisão, não apenas catálogo**: a skill deverá conter playbooks para bootstrap, leitura, planejamento, execução, revisão e encerramento, incluindo quando usar checklist/subtask, quando confirmar ações destrutivas e como tratar `retryable`/conflitos.
  - Alternativa: apenas copiar `apps/mcp/README.md`; descartada porque o README lista ferramentas, mas não é uma instrução completa de comportamento do agente.
- **Comandos com núcleo semântico e mapeamentos por cliente**: cada comando terá intenção, entradas, pré-condições, sequência MCP e resultado esperado em formato neutro. Adaptadores poderão apontar para os formatos de Claude Code, OpenCode, Codex e outros sem alterar a lógica.
  - Alternativa: criar comandos independentes com conteúdo duplicado; descartada pelo risco de divergência.
- **Verificação derivada do catálogo MCP**: adicionar uma verificação que leia o catálogo/políticas do servidor ou uma representação explicitamente mantida e valide nomes documentados, referências essenciais e comandos. A verificação não deve depender de API externa, chave real ou banco persistente.
  - Alternativa: revisão manual somente; descartada porque novas ferramentas poderiam ficar ausentes da skill sem sinal automático.
- **Guideline como gate de mudança**: atualizar `CONTRIBUTING.md` com uma seção de impacto da skill, incluindo checklist de contratos afetados, atualização de referências/comandos e execução do verificador quando MCP ou fluxos AI First mudarem.
  - Alternativa: registrar apenas no README; descartada porque o README não é um gate de contribuição.

## Risks / Trade-offs

- [Catálogo MCP evolui mais rápido que a skill] → validar nomes e contratos em CI e exigir revisão da skill no checklist de PR.
- [Diferenças entre clientes tornam comandos incompatíveis] → manter comandos semânticos canônicos e adaptadores mínimos documentados por cliente.
- [Instruções excessivas podem aumentar o contexto do agente] → separar `SKILL.md` enxuto de referências carregáveis sob demanda.
- [Exemplos podem induzir exposição de credenciais] → usar apenas placeholders, reforçar variáveis de ambiente e adicionar verificação contra tokens reais.
- [Comandos destrutivos podem ser usados sem confirmação] → declarar pré-condições, exigir preview/dry-run quando disponível e pedir confirmação explícita antes da mutação irreversível.

## Migration Plan

1. Criar a fonte canônica, referências e comandos a partir da documentação e dos contratos MCP existentes.
2. Adicionar o verificador e executar validações sem depender de credenciais reais.
3. Atualizar guidelines, README e documentação de integração com instruções de instalação por cliente.
4. Distribuir ou copiar os arquivos para os diretórios específicos somente quando o cliente exigir essa forma.
5. Rollback: remover os arquivos de distribuição e reverter as referências de documentação; não há migração de dados nem alteração de runtime.

## Open Questions

- Quais clientes, além de Claude Code, OpenCode e Codex, terão adaptador mantido na primeira versão?
- O verificador deverá validar somente nomes de ferramentas e comandos ou também schemas completos de argumentos?
- A distribuição deverá incluir um manifesto/versionamento próprio da skill ou usará a versão do repositório?
