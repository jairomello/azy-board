import { describe, expect, test } from 'bun:test'

// O workspace não possui DOM, jsdom ou React Testing Library. Estes testes de
// contrato exercitam a presença dos caminhos de UI no código compilável sem
// adicionar uma infraestrutura de browser fora do escopo da mudança.
async function source(path: string) {
  return fetch(new URL(path, import.meta.url)).then(response => response.text())
}

function contains(text: string, expected: string) {
  expect(text.includes(expected)).toBe(true)
}

function notContains(text: string, expected: string) {
  expect(text.includes(expected)).toBe(false)
}

describe('contrato de UI da visibilidade de projetos', () => {
  test('modal de criação expõe os toggles de restrito e oculto', async () => {
    const text = await source('./pages/ProjectsPage.tsx')
    contains(text, '<VisibilityToggles')
    contains(text, 'restrictedId="new-project-restricted"')
    contains(text, 'hiddenId="new-project-hidden"')
    contains(text, 'restricted={newIsRestricted}')
    contains(text, 'hidden={newIsHidden}')
    contains(text, 'isRestricted: newIsRestricted')
    contains(text, 'isHidden: newIsHidden')
  })

  test('toggles são acessíveis e começam desligados', async () => {
    const text = await source('./pages/ProjectsPage.tsx')
    contains(text, "useState(false)")
    const toggles = await source('./components/VisibilityToggles.tsx')
    contains(toggles, 'role="switch"')
    contains(toggles, 'aria-checked={checked}')
    contains(toggles, 'aria-label={label}')
  })

  test('listagem pede includeHidden somente quando a preferência está ligada', async () => {
    const text = await source('./pages/ProjectsPage.tsx')
    contains(text, "showHiddenProjects ? '/projects?includeHidden=true' : '/projects'")
    contains(text, 'const { user, showHiddenProjects } = useAuth()')
    contains(text, '}, [loadProjects])')
  })

  test('configurações do projeto têm a seção de visibilidade com PATCH', async () => {
    const text = await source('./features/project-settings/components/GeneralSettingsSections.tsx')
    contains(text, 't(\'settings:projectVisibility\')')
    contains(text, '<VisibilityToggles')
    contains(text, "restrictedId=\"project-restricted\"")
    contains(text, "hiddenId=\"project-hidden\"")
    contains(text, "onVisibilityChange('isRestricted', value)")
    contains(text, "onVisibilityChange('isHidden', value)")
  })

  test('dropdown do avatar e página de conta compartilham o mesmo controle', async () => {
    const dropdown = await source('./components/ProfileDropdown.tsx')
    const account = await source('./pages/AccountPage.tsx')
    contains(dropdown, '<ShowHiddenProjectsSwitch labelKey="hiddenProjects" />')
    contains(account, '<ShowHiddenProjectsSwitch />')
    const toggle = await source('./components/ShowHiddenProjectsSwitch.tsx')
    contains(toggle, 'role="switch"')
    contains(toggle, 'aria-checked={showHiddenProjects}')
    contains(toggle, 'setShowHiddenProjects(!showHiddenProjects)')
  })

  test('preferência é de sessão: nunca usa localStorage nem banco', async () => {
    const helper = await source('./lib/sessionPreferences.ts')
    contains(helper, "const CHAVE_PROJETOS_OCULTOS = 'show-hidden-projects'")
    contains(helper, 'sessionStorage.getItem(CHAVE_PROJETOS_OCULTOS)')
    contains(helper, 'sessionStorage.setItem(CHAVE_PROJETOS_OCULTOS, String(valor))')
    notContains(helper, 'localStorage.')

    const auth = await source('./contexts/AuthContext.tsx')
    contains(auth, 'resetarProjetosOcultos()')
    contains(auth, 'gravarMostrarProjetosOcultos(false)')
    notContains(auth, "localStorage.setItem('show-hidden-projects'")
  })
})
