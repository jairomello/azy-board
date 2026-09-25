import type { Page } from 'playwright'
import {
  admin,
  apiUrl,
  assert,
  createModule,
  createProject,
  deleteColumn,
  login,
  logout,
  member,
  openBoardOf,
  waitFor,
  webUrl,
  type Journey,
} from './harness'

interface ApiItem {
  id: string
  title: string
  columnId: string
  position: number
  type: string
}

interface ApiColumn {
  id: string
  name: string
}

function projectIdFromUrl(page: Page): string {
  const match = page.url().match(/projects\/([0-9a-f-]{36})\//)
  assert(match, `não foi possível extrair o projectId de ${page.url()}`)
  return match![1]!
}

async function fetchItems(page: Page, projectId: string): Promise<ApiItem[]> {
  const response = await page.request.get(`${apiUrl}/api/projects/${projectId}/items`)
  assert(response.ok(), `GET items respondeu ${response.status()}`)
  return (await response.json()) as ApiItem[]
}

async function fetchColumns(page: Page, projectId: string): Promise<ApiColumn[]> {
  const response = await page.request.get(`${apiUrl}/api/projects/${projectId}/columns`)
  assert(response.ok(), `GET columns respondeu ${response.status()}`)
  return (await response.json()) as ApiColumn[]
}

async function addCardToFirstColumn(page: Page, title: string) {
  // Idempotente: se o card já existe (retry da jornada), não cria de novo.
  if ((await page.getByText(title, { exact: true }).count()) > 0) return

  // Fecha qualquer formulário de criação que tenha ficado aberto de um passo anterior.
  const placeholder = page.getByPlaceholder('Título do card...')
  if ((await placeholder.count()) > 0) {
    await page.keyboard.press('Escape')
    await placeholder.first().waitFor({ state: 'detached', timeout: 5_000 }).catch(() => undefined)
  }
  await page.getByRole('button', { name: 'Adicionar card' }).first().click()
  await placeholder.first().fill(title)
  await page.getByRole('button', { name: 'Adicionar', exact: true }).first().click()
  await page.getByText(title, { exact: true }).waitFor({ timeout: 15_000 })
}

async function dragCard(page: Page, cardTitle: string, target: { x: number; y: number }) {
  const cardText = page.getByText(cardTitle, { exact: true }).first()
  const grip = cardText.locator('xpath=ancestor::div[.//*[@title="Arrastar card"]][1]').locator('[title="Arrastar card"]')
  const source = await grip.boundingBox()
  assert(source, `não localizou o grip do card ${cardTitle}`)

  const start = { x: source!.x + source!.width / 2, y: source!.y + source!.height / 2 }
  await page.mouse.move(start.x, start.y)
  await page.waitForTimeout(120)
  await page.mouse.down()
  await page.waitForTimeout(120)
  await page.mouse.move(start.x + 14, start.y + 14, { steps: 6 })
  await page.waitForTimeout(80)
  await page.mouse.move(target.x, target.y, { steps: 30 })
  await page.waitForTimeout(120)
  await page.mouse.move(target.x, target.y + 2, { steps: 4 })
  await page.waitForTimeout(80)
  await page.mouse.up()
  await page.waitForTimeout(200)
}

function columnContainer(page: Page, columnName: string) {
  return page.getByText(columnName, { exact: true }).first()
    .locator('xpath=ancestor::div[.//button[normalize-space()="Adicionar card"]][1]')
}

async function dragCardToColumn(page: Page, cardTitle: string, columnName: string) {
  const box = await columnContainer(page, columnName).boundingBox()
  assert(box, `não localizou a coluna ${columnName}`)
  await dragCard(page, cardTitle, { x: box!.x + box!.width / 2, y: box!.y + box!.height - 28 })
}

async function dragCardAboveCard(page: Page, cardTitle: string, targetTitle: string) {
  const target = page.getByText(targetTitle, { exact: true }).first()
  const box = await target.boundingBox()
  assert(box, `não localizou o card ${targetTitle}`)
  // Solta na metade superior do card-alvo para posicionar antes dele.
  await dragCard(page, cardTitle, { x: box!.x + box!.width / 2, y: box!.y + 4 })
}

async function openSettings(page: Page) {
  await page.getByRole('link', { name: 'Configurações' }).click()
  await page.waitForURL('**/settings', { timeout: 15_000 })
}

async function createAndDeleteSquad(page: Page, squadName: string) {
  await page.getByRole('button', { name: 'Membros & Squads' }).click()
  await page.getByPlaceholder('Nome do squad').fill(squadName)
  await page.getByRole('button', { name: 'Criar squad' }).click()
  await page.getByText(squadName, { exact: false }).first().waitFor({ timeout: 15_000 })

  const row = page.getByText(squadName, { exact: false }).first().locator('xpath=ancestor::div[contains(@class,"justify-between")][1]')
  await row.getByRole('button').last().click()
  await page.getByRole('heading', { name: `Excluir squad "${squadName}"` }).waitFor({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Confirmar' }).click()
  await waitFor(async () => (await page.getByText(squadName, { exact: false }).count()) === 0, `squad ${squadName} removido`)
}

async function deleteModule(page: Page, moduleName: string) {
  await page.getByRole('button', { name: 'Módulos' }).click()
  const row = page.getByText(moduleName, { exact: true }).first().locator('xpath=ancestor::div[contains(@class,"justify-between")][1]')
  await row.getByRole('button').last().click()

  // Módulo sem épicos é excluído direto; com épicos abre a confirmação.
  const heading = page.getByRole('heading', { name: `Excluir módulo "${moduleName}"` })
  const confirmou = await heading.waitFor({ state: 'visible', timeout: 3_000 }).then(() => true).catch(() => false)
  if (confirmou) await page.getByRole('button', { name: 'Excluir tudo' }).click()

  await waitFor(async () => (await page.getByText(moduleName, { exact: true }).count()) === 0, `módulo ${moduleName} removido`)
}

export const journeys: Journey[] = [
  {
    name: 'login autentica e chega em /projects',
    run: async page => {
      await login(page)
    },
  },
  {
    name: 'cria projeto simples pela UI',
    run: async page => {
      await createProject(page, 'Projeto E2E', 'SIMPLE')
    },
  },
  {
    name: 'abre o board do projeto',
    run: async page => {
      await openBoardOf(page, 'Projeto E2E')
    },
  },
  {
    name: 'cria cards, move entre colunas e reordena por arrastar',
    run: async page => {
      const projectId = projectIdFromUrl(page)
      await addCardToFirstColumn(page, 'Card A')
      await addCardToFirstColumn(page, 'Card B')

      const columns = await fetchColumns(page, projectId)
      const doing = columns.find(column => column.name === 'Fazendo')
      assert(doing, 'coluna Fazendo não encontrada')

      // Reordena dentro da mesma coluna: Card B passa para antes do Card A.
      await dragCardAboveCard(page, 'Card B', 'Card A')
      await waitFor(async () => {
        const items = await fetchItems(page, projectId)
        const a = items.find(item => item.title === 'Card A')
        const b = items.find(item => item.title === 'Card B')
        return Boolean(a && b && b.columnId === a.columnId && b.position < a.position)
      }, 'Card B reordenado antes do Card A no Backlog')

      // Arquivar mantém o columnId no banco; a UI envia apenas cards visíveis.
      await addCardToFirstColumn(page, 'Card arquivado')
      const archived = (await fetchItems(page, projectId)).find(item => item.title === 'Card arquivado')
      assert(archived, 'card para arquivamento não encontrado')
      const archive = await page.request.post(`${apiUrl}/api/projects/${projectId}/items/${archived.id}/archive`)
      assert(archive.ok(), `arquivamento respondeu ${archive.status()}`)
      await page.reload()
      await page.getByText('Card A', { exact: true }).waitFor()
      await dragCardAboveCard(page, 'Card A', 'Card B')
      await waitFor(async () => {
        const items = await fetchItems(page, projectId)
        const a = items.find(item => item.title === 'Card A')
        const b = items.find(item => item.title === 'Card B')
        return Boolean(a && b && a.position < b.position)
      }, 'ordem persistida mesmo com card arquivado na coluna')

      // Move entre colunas: Card B vai para Fazendo.
      await dragCardToColumn(page, 'Card B', 'Fazendo')
      await waitFor(async () => {
        const items = await fetchItems(page, projectId)
        return items.find(item => item.title === 'Card B')?.columnId === doing!.id
      }, 'Card B persistido na coluna Fazendo')
    },
  },
  {
    name: 'exclui coluna em Configurações sem erro',
    run: async page => {
      await deleteColumn(page, 'A Fazer')
    },
  },
  {
    name: 'cria e exclui módulo e squad em Configurações',
    run: async page => {
      await page.goto(`${webUrl}/projects`)
      await createProject(page, 'Projeto Hierárquico E2E')
      await openBoardOf(page, 'Projeto Hierárquico E2E')
      await createModule(page, 'Módulo E2E')
      await openSettings(page)
      await deleteModule(page, 'Módulo E2E')
      await createAndDeleteSquad(page, 'Squad E2E')
    },
  },
  {
    name: 'membro sem permissão é bloqueado pela API de administração',
    run: async page => {
      await logout(page)
      await login(page, member)
      const response = await page.request.get(`${apiUrl}/api/users`)
      assert(response.status() === 403, `esperava 403 para membro, recebeu ${response.status()}`)
    },
  },
  {
    name: 'Azy Agent responde de forma determinística',
    run: async page => {
      await logout(page)
      await login(page, admin)
      await page.getByRole('button', { name: 'Abrir Azy Agent' }).click()
      await page.getByRole('textbox', { name: 'Mensagem para o Azy Agent' }).fill('Olá, agente de teste')
      await page.getByRole('button', { name: 'Enviar mensagem' }).click()
      await page.getByText('Resposta determinística do agente de teste.').waitFor({ timeout: 30_000 })
    },
  },
]
