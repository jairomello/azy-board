## 1. Carregar nome do projeto no BoardPage

- [x] 1.1 Adicionar estado `const [projectName, setProjectName] = useState('')` em `BoardPage.tsx`
- [x] 1.2 Incluir `api.get<{ name: string }>(`/projects/${projectId}`).catch(() => ({ name: '' }))` no `Promise.all` de inicialização
- [x] 1.3 Extrair o nome do resultado do `Promise.all` e chamar `setProjectName(proj.name)`

## 2. Atualizar o breadcrumb do header

- [x] 2.1 Alterar o `<nav>` do header em `BoardPage.tsx`: após `<span>Board</span>`, adicionar separador `·` e `<span>{projectName}</span>` condicionalmente (apenas quando `projectName` não for vazio)

## 3. Definir document.title

- [x] 3.1 Adicionar `useEffect` que define `document.title = projectName ? \`${projectName} · Board\` : 'Board'` quando `projectName` muda
- [x] 3.2 Retornar cleanup no mesmo `useEffect` para restaurar `document.title` ao padrão ao desmontar o componente
