#!/usr/bin/env node
/**
 * connect-mcp.mjs — conecta um code agent ao MCP remoto do Azy Board.
 *
 * Cross-platform (Windows, Linux e macOS), sem dependências externas: usa o
 * `fetch` global do Node 18+. O script PEDE a API Key no terminal (entrada
 * oculta), valida o handshake e grava a configuração do cliente — a chave não
 * passa pelo chat nem por arquivo versionado.
 *
 * Uso:
 *   node connect-mcp.mjs --client opencode --url https://host/mcp
 *   node connect-mcp.mjs --client claude   --url https://host/mcp --scope user
 *   node connect-mcp.mjs --client codex    --url https://host/mcp
 *   node connect-mcp.mjs --client opencode --url https://host/mcp --print
 *
 * Clientes: opencode | claude | codex | generic
 * Escopos:  project (padrão para opencode/claude) | user (padrão para codex)
 *
 * Flags:
 *   --client <c>       opencode | claude | codex | generic (padrão: pergunta)
 *   --url <url>        URL do endpoint MCP (padrão: pergunta)
 *   --scope <s>        project | user
 *   --config <arquivo> caminho explícito do arquivo de configuração
 *   --name <nome>      nome do servidor no cliente (padrão: azy-board)
 *   --project-id <id>  contexto de projeto (cabeçalho X-Azyboard-Project-Id)
 *   --print            só valida e imprime a configuração, sem gravar
 *   --force            permite gravar em arquivo versionado (com aviso)
 *   -h, --help         ajuda
 */

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

const CLIENTS = ['opencode', 'claude', 'codex', 'generic']

function usage() {
  const src = readFileSync(new URL(import.meta.url), 'utf8')
  const header = src.split('\n').filter(line => line.startsWith(' *')).slice(7).map(line => line.replace(/^ \* ?/, ''))
  console.log(header.join('\n'))
}

function parseArgs(argv) {
  const args = { name: 'azy-board', print: false, force: false }
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i]
    const value = argv[i + 1]
    switch (key) {
      case '--client': args.client = value; i += 1; break
      case '--url': args.url = value; i += 1; break
      case '--scope': args.scope = value; i += 1; break
      case '--config': args.config = value; i += 1; break
      case '--name': args.name = value ?? args.name; i += 1; break
      case '--project-id': args.projectId = value; i += 1; break
      case '--print': args.print = true; break
      case '--force': args.force = true; break
      case '-h': case '--help': args.help = true; break
      default: throw new Error(`Opção desconhecida: ${key}`)
    }
  }
  return args
}

function ask(query, { hidden = false } = {}) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin
    const stdout = process.stdout
    if (!stdin.isTTY) {
      let data = ''
      stdin.setEncoding('utf8')
      stdin.once('data', chunk => {
        data += chunk
        resolve(String(data).split(/\r?\n/)[0].trim())
      })
      stdin.once('error', reject)
      stdin.resume()
      return
    }
    stdout.write(query)
    if (!hidden) {
      let data = ''
      stdin.resume()
      stdin.once('data', chunk => {
        data += chunk
        stdout.write('\n')
        resolve(String(data).split(/\r?\n/)[0].trim())
      })
      stdin.once('error', reject)
      return
    }
    stdin.setRawMode(true)
    stdin.resume()
    let buffer = ''
    const onData = chunk => {
      for (const ch of String(chunk)) {
        if (ch === '\r' || ch === '\n' || ch === '\u0004') {
          stdin.setRawMode(false)
          stdin.pause()
          stdin.removeListener('data', onData)
          stdout.write('\n')
          resolve(buffer)
          return
        }
        if (ch === '\u0003') {
          stdin.setRawMode(false)
          stdout.write('\n')
          process.exit(130)
        }
        if (ch === '\u007f' || ch === '\b') buffer = buffer.slice(0, -1)
        else buffer += ch
      }
    }
    stdin.on('data', onData)
    stdin.once('error', reject)
  })
}

function defaultConfig(client, scope) {
  const home = homedir()
  if (client === 'opencode') {
    return scope === 'user'
      ? join(process.env.XDG_CONFIG_HOME || join(home, '.config'), 'opencode', 'opencode.json')
      : join(process.cwd(), 'opencode.json')
  }
  if (client === 'claude') {
    return scope === 'user' ? join(home, '.claude.json') : join(process.cwd(), '.mcp.json')
  }
  if (client === 'codex') return join(home, '.codex', 'config.toml')
  return ''
}

function headersFor(key, projectId) {
  const headers = { Authorization: `Bearer ${key}` }
  if (projectId) headers['X-Azyboard-Project-Id'] = projectId
  return headers
}

function entryFor(client, url, key, projectId) {
  const headers = headersFor(key, projectId)
  if (client === 'opencode') return { type: 'remote', url, enabled: true, oauth: false, timeout: 30000, headers }
  if (client === 'claude') return { type: 'http', url, headers }
  return { url, headers }
}

function masked(entry) {
  const copy = JSON.parse(JSON.stringify(entry))
  copy.headers.Authorization = `Bearer ${String(entry.headers.Authorization).slice(7, 13)}…`
  return copy
}

function tomlBlock(name, url, key, projectId) {
  const esc = value => String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  const headers = [`"Authorization" = "Bearer ${esc(key)}"`]
  if (projectId) headers.push(`"X-Azyboard-Project-Id" = "${esc(projectId)}"`)
  return `[mcp_servers.${name}]\nurl = "${esc(url)}"\nhttp_headers = { ${headers.join(', ')} }\n`
}

function maskedToml(name, url, key, projectId) {
  return tomlBlock(name, url, `Bearer ${key.slice(0, 6)}…`, projectId)
}

function isTracked(file) {
  const dir = dirname(file)
  const git = spawnSync('git', ['-C', dir, 'rev-parse', '--is-inside-work-tree'], { encoding: 'utf8' })
  if (git.status !== 0) return false
  const tracked = spawnSync('git', ['-C', dir, 'ls-files', '--error-unmatch', file.split(/[\\/]/).pop()], { encoding: 'utf8' })
  return tracked.status === 0
}

function writeJson(file, client, name, entry) {
  let data = {}
  let existing = null
  if (existsSync(file)) {
    existing = readFileSync(file, 'utf8')
    data = existing.trim() ? JSON.parse(existing) : {}
    if (typeof data !== 'object' || data === null || Array.isArray(data)) throw new Error(`'${file}' não é um objeto JSON.`)
  }
  const root = client === 'opencode' ? 'mcp' : 'mcpServers'
  if (typeof data[root] !== 'object' || data[root] === null) data[root] = {}
  data[root][name] = entry
  mkdirSync(dirname(file), { recursive: true })
  if (existing !== null) writeFileSync(`${file}.bak`, existing, 'utf8')
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

function writeToml(file, name, url, key, projectId) {
  const block = tomlBlock(name, url, key, projectId)
  let text = existsSync(file) ? readFileSync(file, 'utf8') : ''
  const pattern = new RegExp(`\\[mcp_servers\\.${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\][^\\[]*`, 'm')
  const hadSection = pattern.test(text)
  text = text.replace(pattern, '')
  if (text && !text.endsWith('\n')) text += '\n'
  if (text.trim()) text += '\n'
  text += block
  mkdirSync(dirname(file), { recursive: true })
  if (existsSync(file)) writeFileSync(`${file}.bak`, readFileSync(file), 'utf8')
  writeFileSync(file, text, 'utf8')
  return hadSection
}

async function validate(url, key, projectId) {
  const headers = {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    ...(projectId ? { 'X-Azyboard-Project-Id': projectId } : {}),
  }
  const post = async body => {
    const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
    const text = await response.text()
    return { status: response.status, text }
  }
  const init = await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'connect-mcp', version: '1' } } })
  if (init.status !== 200) {
    throw new Error(`initialize falhou (HTTP ${init.status}).\n  - 401: API Key ausente/inválida/revogada ou fora do escopo.\n  - 404: URL errada ou endpoint MCP desabilitado na instalação.`)
  }
  const listed = await post({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })
  if (listed.status !== 200) throw new Error(`tools/list falhou (HTTP ${listed.status}).`)
  let tools = '?'
  try { tools = (JSON.parse(listed.text).result?.tools ?? []).length } catch { /* corpo inesperado */ }
  return tools
}

async function main() {
  let args
  try { args = parseArgs(process.argv.slice(2)) } catch (error) {
    console.error(error.message)
    usage()
    process.exit(2)
  }
  if (args.help) { usage(); return }

  if (!args.url) args.url = await ask('URL do MCP (ex.: https://host/mcp): ')
  if (!args.url) throw new Error('URL do MCP é obrigatória.')
  if (!args.client) {
    args.client = (await ask('Cliente (opencode/claude/codex/generic) [opencode]: ')) || 'opencode'
  }
  if (!CLIENTS.includes(args.client)) throw new Error(`Cliente inválido: ${args.client}. Use: ${CLIENTS.join(', ')}`)
  if (!args.scope) args.scope = args.client === 'codex' ? 'user' : 'project'
  if (!['project', 'user'].includes(args.scope)) throw new Error(`Escopo inválido: ${args.scope}. Use: project, user`)

  const key = (await ask('API Key (não aparece enquanto digita): ', { hidden: true })).trim()
  if (!key) throw new Error('API Key é obrigatória.')

  const tools = await validate(args.url, key, args.projectId)
  console.log(`Conexão validada: handshake OK, ${tools} ferramentas disponíveis.`)
  console.log(`Credencial: ${key.slice(0, 6)}… (mascarada).`)

  const entry = entryFor(args.client, args.url, key, args.projectId)

  if (args.print) {
    console.log(`\nConfiguração para '${args.client}' (não gravada):`)
    if (args.client === 'codex') console.log(maskedToml(args.name, args.url, key, args.projectId))
    else console.log(JSON.stringify(masked(entry), null, 2))
    return
  }

  let config = args.config || defaultConfig(args.client, args.scope)
  if (!config) {
    console.log(`\nCliente '${args.client}': cole a configuração abaixo no arquivo do cliente:`)
    if (args.client === 'codex') console.log(tomlBlock(args.name, args.url, key, args.projectId))
    else console.log(JSON.stringify(entry, null, 2))
    return
  }

  if (isTracked(config) && !args.force) {
    console.error(`AVISO: '${config}' é versionado no git e passaria a conter a API Key.`)
    console.error('Use --force para continuar mesmo assim, ou escolha um arquivo ignorado (--config).')
    process.exit(3)
  }

  if (args.client === 'codex') {
    const replaced = writeToml(config, args.name, args.url, key, args.projectId)
    console.log(`\nConfiguração ${replaced ? 'atualizada' : 'adicionada'} em ${config}`)
    console.log(maskedToml(args.name, args.url, key, args.projectId))
  } else {
    writeJson(config, args.client, args.name, entry)
    console.log(`\nConfiguração gravada em ${config}`)
    console.log(JSON.stringify(masked(entry), null, 2))
  }

  console.log('\nPróximos passos:')
  console.log('  1. Reinicie/recarregue o cliente de code agent para reconectar o MCP.')
  console.log('  2. Confirme que "list_tasks" e "list_modules" aparecem e respondem.')
  console.log('  3. A chave é segredo: se ela foi exposta, revogue em Minha conta e gere outra.')
}

main().catch(error => {
  console.error(`\nFalha: ${error.message}`)
  process.exit(1)
})
