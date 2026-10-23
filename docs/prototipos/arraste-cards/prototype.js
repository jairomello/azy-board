// Protótipo isolado: a estrutura e as classes seguem os componentes reais do board.
const initialCards = {
  todo: [
    { code: 'AZY-284', title: 'Revisar hierarquia visual dos cards no quadro', path: 'Experiência do produto › Quadro Kanban', icon: '✦', iconColor: '#7b61dd', tags: [['design-system', '#715be4'], ['frontend', '#3988e5']], type: 'Tarefa', priority: 'ALTA', points: 5, progress: [2, 5], avatar: 'ML' },
    { code: 'AZY-291', title: 'Adicionar navegação por teclado às ações rápidas', path: 'Plataforma › Acessibilidade', icon: '◈', iconColor: '#21a5ba', tags: [['a11y', '#21a5ba']], type: 'Bug', priority: 'MÉDIA', points: 3, avatar: 'RA' },
    { code: 'AZY-302', title: 'Definir eventos de auditoria para alterações de cards', path: 'Fundação › Observabilidade', icon: '◎', iconColor: '#d89d38', tags: [['telemetria', '#bd8933'], ['backend', '#728297']], type: 'História', priority: 'BAIXA', points: 8, avatar: 'AS' },
  ],
  doing: [
    { code: 'AZY-276', title: 'Implementar seletor de responsáveis com presença de agentes', path: 'Experiência do produto › Componentes', icon: '◉', iconColor: '#29a885', tags: [['agent-ready', '#309f83'], ['frontend', '#3988e5']], type: 'Tarefa', priority: 'CRÍTICA', points: 8, progress: [3, 4], avatar: 'CX' },
    { code: 'AZY-251', title: 'Unificar estados de carregamento na autenticação', path: 'Fundação › Identidade e acesso', icon: '⌘', iconColor: '#3988e5', tags: [['auth', '#3988e5']], type: 'Bug', priority: 'ALTA', points: 3, progress: [4, 4], avatar: 'RA' },
    { code: 'AZY-257', title: 'Reorganizar resumo do projeto para leitura rápida', path: 'Experiência do produto › Página inicial', icon: '✦', iconColor: '#7b61dd', tags: [['UX', '#bd8933']], type: 'História', priority: 'BAIXA', points: 5, avatar: 'AS' },
  ],
  review: [
    { code: 'AZY-265', title: 'Revisar permissões de edição em projetos compartilhados', path: 'Plataforma › Acesso', icon: '◇', iconColor: '#9165df', tags: [['segurança', '#9165df']], type: 'Tarefa', priority: 'ALTA', points: 5, progress: [2, 3], avatar: 'JC' },
    { code: 'AZY-269', title: 'Validar estados vazios do quadro em telas menores', path: 'Experiência do produto › Quadro Kanban', icon: '◈', iconColor: '#21a5ba', tags: [['mobile', '#21a5ba']], type: 'Bug', priority: 'MÉDIA', points: 2, avatar: 'ML' },
  ],
  done: [
    { code: 'AZY-243', title: 'Salvar filtros recentes no projeto', path: 'Experiência do produto › Quadro Kanban', icon: '✓', iconColor: '#20ad80', tags: [['entregue', '#20ad80']], type: 'Tarefa', priority: 'MÉDIA', points: 3, avatar: 'JC' },
    { code: 'AZY-238', title: 'Corrigir contraste das etiquetas no tema escuro', path: 'Fundação › Qualidade', icon: '✓', iconColor: '#20ad80', tags: [['acessibilidade', '#21a5ba']], type: 'Bug', priority: 'ALTA', points: 2, avatar: 'ML' },
  ],
}

const colors = { todo: '#94a3b8', doing: '#367bf5', review: '#8b5cf6', done: '#10b981' }
const columns = [...document.querySelectorAll('.board-column')]
const status = document.getElementById('status')
const order = document.getElementById('order')
const animations = new WeakMap()
let pending = null
let drag = null
let settling = false
let locked = false

function cardMarkup(card) {
  const tagMarkup = card.tags.map(([name, color]) => `<span class="tag" style="background:${color}">${name}</span>`).join('')
  const typeClass = { Tarefa: 'task', Bug: 'bug', História: 'story' }[card.type]
  const priorityClass = { ALTA: 'high', MÉDIA: 'medium', BAIXA: 'low', CRÍTICA: 'critical' }[card.priority]
  const avatarClass = card.avatar === 'AS' ? 'green' : card.avatar === 'RA' ? 'blue' : card.avatar === 'CX' ? 'orange' : ''
  const progress = card.progress ? `<div class="checklist-progress"><span>✓ ${card.progress[0]}/${card.progress[1]}</span><div class="progress-track"><i style="width:${100 * card.progress[0] / card.progress[1]}%"></i></div></div>` : ''
  return `<div class="kanban-card-grip" role="button" tabindex="0" aria-label="Arrastar ${card.code}" title="Arrastar card"><span class="grip-icon" aria-hidden="true">✥</span></div>
    <div class="kanban-card-content"><div class="kanban-card-topo"><span class="item-icon" style="color:${card.iconColor};background:${card.iconColor}19">${card.icon}</span><span class="sequence-code">${card.code}</span><div class="kanban-card__acoes" aria-hidden="true"><span>▢</span><span>▱</span><span>⌫</span></div></div>
    <div class="kanban-card-breadcrumb">${card.path}</div><div class="kanban-card-title"><p>${card.title}</p></div>
    <div class="card-label-row"><div class="card-tags">${tagMarkup}</div><span class="type-pill type-${typeClass}">${card.type}</span></div>${progress}
    <div class="kanban-card-footer"><span class="priority ${priorityClass}">${card.priority}</span><span>${card.points}pt</span><span class="avatar ${avatarClass}">${card.avatar}</span></div></div>`
}

function createCard(card, columnId) {
  const element = document.createElement('article')
  element.className = 'kanban-card'
  element.dataset.code = card.code
  element.style.setProperty('--status-color', colors[columnId])
  element.innerHTML = cardMarkup(card)
  return element
}

function renderInitial() {
  for (const column of columns) {
    const list = column.querySelector('.board-column-cards')
    for (const card of initialCards[column.dataset.column]) list.append(createCard(card, column.dataset.column))
  }
  updateSummary()
}

function updateSummary() {
  const parts = []
  for (const column of columns) {
    const codes = [...column.querySelectorAll('.board-column-cards > .kanban-card')].map(card => card.dataset.code)
    column.querySelector('.board-column-count').textContent = codes.length
    parts.push(`${column.getAttribute('aria-label')}: ${codes.join(' · ') || 'vazia'}`)
  }
  order.textContent = parts.join('  |  ')
}

function updatePreviewCounts() {
  for (const column of columns) {
    column.querySelector('.board-column-count').textContent = column.querySelectorAll('.board-column-cards > .kanban-card, .board-column-cards > .drop-shadow').length
  }
}

function measureCards() {
  return new Map([...document.querySelectorAll('.board-column-cards > .kanban-card')].map(card => [card, card.getBoundingClientRect()]))
}

function animateLayout(before) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  for (const [card, oldRect] of before) {
    if (!card.isConnected) continue
    const oldAnimation = animations.get(card)
    if (oldAnimation) oldAnimation.cancel()
    const newRect = card.getBoundingClientRect()
    const dx = oldRect.left - newRect.left
    const dy = oldRect.top - newRect.top
    if (Math.abs(dx) < .5 && Math.abs(dy) < .5) continue
    const animation = card.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], { duration: 190, easing: 'cubic-bezier(.2,.8,.2,1)' })
    animations.set(card, animation)
  }
}

function columnAt(x, y) {
  return columns.find(column => {
    const rect = column.getBoundingClientRect()
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
  }) || null
}

function clearColumnHints() {
  for (const column of columns) column.classList.remove('is-target', 'is-rejected')
}

function moveShadow(list, beforeNode) {
  if (drag.shadow.parentElement === list && drag.shadow.nextElementSibling === beforeNode) return
  const before = measureCards()
  list.insertBefore(drag.shadow, beforeNode)
  animateLayout(before)
  updatePreviewCounts()
}

function moveProjection(column, y) {
  const list = column.querySelector('.board-column-cards')
  const others = [...list.children].filter(node => node !== drag.shadow)
  const listTop = list.getBoundingClientRect().top
  const beforeNode = others.find(node => y < listTop + node.offsetTop + node.offsetHeight / 2) || null
  moveShadow(list, beforeNode)
}

function moveShadowHome() {
  moveShadow(drag.originList, drag.originNext)
}

function updatePointer(event) {
  if (!drag) return
  drag.x = event.clientX
  drag.y = event.clientY
  drag.overlay.style.left = `${event.clientX - drag.offsetX}px`
  drag.overlay.style.top = `${event.clientY - drag.offsetY}px`
  const column = columnAt(event.clientX, event.clientY)
  clearColumnHints()
  drag.valid = Boolean(column && !(locked && column.dataset.column === 'review'))
  if (!column) {
    moveShadowHome()
    status.textContent = 'Fora das colunas: soltar aqui cancela o movimento.'
    return
  }
  column.classList.add(drag.valid ? 'is-target' : 'is-rejected')
  if (!drag.valid) {
    moveShadowHome()
    status.textContent = 'Revisão está bloqueada. Soltar aqui devolve o card à origem.'
    return
  }
  moveProjection(column, event.clientY)
  const index = [...drag.shadow.parentElement.children].indexOf(drag.shadow) + 1
  status.textContent = `${drag.card.dataset.code} → ${column.getAttribute('aria-label')}, posição ${index}. Solte para confirmar.`
}

function startDrag(event) {
  const card = pending.card
  const rect = card.getBoundingClientRect()
  const originList = card.parentElement
  const originNext = card.nextElementSibling
  const shadow = document.createElement('div')
  shadow.className = 'drop-shadow'
  shadow.style.setProperty('--ghost-height', `${rect.height}px`)
  shadow.setAttribute('aria-label', 'Posição prevista de soltura')
  const overlay = card.cloneNode(true)
  overlay.classList.add('drag-overlay')
  overlay.setAttribute('aria-hidden', 'true')
  overlay.querySelector('.kanban-card-grip').tabIndex = -1
  overlay.style.left = `${rect.left}px`
  overlay.style.top = `${rect.top}px`
  overlay.style.width = `${rect.width}px`
  overlay.style.height = `${rect.height}px`
  originList.replaceChild(shadow, card)
  document.body.append(overlay)
  document.body.classList.add('is-dragging')
  drag = { card, originList, originNext, originRect: rect, shadow, overlay, offsetX: pending.x - rect.left, offsetY: pending.y - rect.top, x: event.clientX, y: event.clientY, valid: true }
  pending = null
  updatePreviewCounts()
  updatePointer(event)
}

function finishDrag(accept) {
  if (!drag) return
  if (!accept) moveShadowHome()
  const current = drag
  drag = null
  settling = true
  clearColumnHints()
  document.body.classList.remove('is-dragging')
  const destination = current.shadow.getBoundingClientRect()
  const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : accept ? 180 : 220
  current.overlay.classList.add(accept ? 'is-settling' : 'is-reverting')
  requestAnimationFrame(() => {
    current.overlay.style.left = `${destination.left}px`
    current.overlay.style.top = `${destination.top}px`
    current.overlay.style.transform = 'rotate(0) scale(1)'
  })
  window.setTimeout(() => {
    if (accept) {
      current.shadow.replaceWith(current.card)
      const destinationColumn = current.card.closest('.board-column')
      current.card.style.setProperty('--status-color', colors[destinationColumn.dataset.column])
      status.textContent = `${current.card.dataset.code} movido para ${destinationColumn.getAttribute('aria-label')}. A ordem já estava pronta antes de soltar.`
    } else {
      current.shadow.replaceWith(current.card)
      status.textContent = `${current.card.dataset.code} voltou à origem: destino impedido ou fora das colunas.`
    }
    current.overlay.remove()
    updateSummary()
    settling = false
  }, duration + 25)
}

document.getElementById('board-columns').addEventListener('pointerdown', event => {
  const grip = event.target.closest('.kanban-card-grip')
  if (!grip || event.button !== 0 || drag || settling) return
  const card = grip.closest('.kanban-card')
  pending = { card, x: event.clientX, y: event.clientY, pointerId: event.pointerId }
  event.preventDefault()
})

window.addEventListener('pointermove', event => {
  if (pending && event.pointerId === pending.pointerId && Math.hypot(event.clientX - pending.x, event.clientY - pending.y) >= 5) startDrag(event)
  else if (drag) updatePointer(event)
})

window.addEventListener('pointerup', event => {
  if (pending && event.pointerId === pending.pointerId) pending = null
  if (drag) {
    updatePointer(event)
    finishDrag(drag.valid)
  }
})

window.addEventListener('pointercancel', () => { pending = null; finishDrag(false) })
window.addEventListener('blur', () => { pending = null; finishDrag(false) })
window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && drag) { event.preventDefault(); finishDrag(false) }
})

document.getElementById('lock-toggle').addEventListener('click', event => {
  locked = !locked
  event.currentTarget.setAttribute('aria-pressed', String(locked))
  event.currentTarget.textContent = `Bloquear Revisão: ${locked ? 'ligado' : 'desligado'}`
  document.querySelector('[data-column="review"]').classList.toggle('is-locked', locked)
  status.textContent = locked ? 'Revisão bloqueada: arraste um card até ela para ver o retorno à origem.' : 'Revisão liberada para receber cards.'
})

document.getElementById('theme-toggle').addEventListener('click', event => {
  const dark = document.body.classList.toggle('dark')
  event.currentTarget.setAttribute('aria-pressed', String(dark))
  event.currentTarget.textContent = dark ? 'Tema claro' : 'Tema escuro'
})

document.getElementById('reset').addEventListener('click', () => window.location.reload())
renderInitial()
