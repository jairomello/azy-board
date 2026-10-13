# Tasks

## 1. Empacotamento da skill em `.zip`

- [ ] 1.1 Criar `apps/api/src/services/skillArchive.ts` com o resolvedor do diretório da skill (`AZYBOARD_SKILL_DIR` + candidatos `skills/azyboard`, `../../skills/azyboard`, `../skills/azyboard`) e a leitura recursiva da árvore; verificar com teste unitário que resolve o diretório em dev e que diretório ausente produz erro acionável
- [ ] 1.2 Implementar o escritor de `.zip` (deflate via `node:zlib` e crc32) que empacota todas as entradas sob a raiz `azyboard/`, incluindo subpastas; verificar com teste que abre o arquivo por um leitor independente e confirma SKILL.md, `commands/`, `references/`, `scripts/` e `manifest.json` presentes
- [ ] 1.3 Ler a versão do `manifest.json` da skill e expor o nome do arquivo (`azyboard-skill-<versão>.zip`); verificar com teste que a versão do nome casa com `skills/azyboard/manifest.json`
- [ ] 1.4 Adicionar memoização por assinatura do diretório (versão + mtime/tamanho dos arquivos) e verificar com teste que o segundo acesso reutiliza o resultado e que alterar um arquivo invalida o cache
- [ ] 1.5 Adicionar teste que varre o conteúdo do `.zip` por padrões de segredo (ex.: `azb_`, `EASYBOARD_API_KEY` com valor real) e falha se encontrar credencial; verificar rodando o teste

## 2. Endpoint autenticado de download

- [ ] 2.1 Criar `apps/api/src/routes/skills.ts` com `GET /azyboard/download` protegido por `authMiddleware`, respondendo `application/zip` com `Content-Disposition: attachment; filename="azyboard-skill-<versão>.zip"` e o corpo do `.zip`; verificar com teste de rota que a resposta tem os cabeçalhos e bytes esperados
- [ ] 2.2 Montar o router em `apps/api/src/index.ts` sob `api.route('/skills', skillsRouter)`; verificar com teste de integração que `GET /api/skills/azyboard/download` autenticado retorna 200 e que sem sessão retorna 401
- [ ] 2.3 Tratar o diretório da skill ausente com erro claro (não 200 vazio) e verificar com teste que aponta a configuração `AZYBOARD_SKILL_DIR`
- [ ] 2.4 Embarçar a skill na imagem: copiar `skills/azyboard` no estágio de runtime do `Dockerfile` e definir `AZYBOARD_SKILL_DIR=/app/skills/azyboard`; verificar inspecionando o `Dockerfile` e confirmando que o caminho copiado casa com o `ENV`

## 3. Botão de download na seção de API Keys

- [ ] 3.1 Adicionar o botão de download em `apps/web/src/components/McpConnectionGuide.tsx`, ao lado do controle de copiar a instrução, usando `<a download>` com `resolveAppUrl('/api/skills/azyboard/download')`; verificar com teste de componente que o link existe, aponta para a rota e tem o atributo `download`
- [ ] 3.2 Adicionar as strings do botão e das mensagens no namespace `settings` em pt-BR, en e es; verificar com teste de paridade de chaves nos três idiomas
- [ ] 3.3 Tratar falha de download com mensagem visível sem travar a tela, mantendo os controles de copiar URL e copiar instrução funcionais; verificar com teste de componente que os controles existentes seguem operando
- [ ] 3.4 Verificar que o link reflete o base path publicado (ex.: `/azyboard/`); verificar com teste de componente ajustando `window.__BASE_PATH__`

## 4. Verificação de integração

- [ ] 4.1 Rodar `bun run test:agent-skill` e confirmar que a skill canônica e o espelho seguem sincronizados após a mudança
- [ ] 4.2 Rodar `bun run check` (typecheck + lint + testes + build) e corrigir o que falhar
- [ ] 4.3 Rodar `bun run test:smoke` e confirmar o download do `.zip` pela seção de API Keys de ponta a ponta

## Workflow follow-up

- Arquivar a change após a revisão do projeto, registrando o card correspondente no Azy Board, se houver.
