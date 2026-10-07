import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync } from 'node:fs'
import { join, relative } from 'node:path'
import { randomUUID } from 'node:crypto'

const root = process.cwd()
const forbiddenApiImports = /(?:from\s*|import\s*\()\s*['"][^'"]*(?:apps\/mcp|mcp\/src|@azy-board\/mcp)[^'"]*['"]/g
const forbiddenExecutionImports = /(?:from\s*|import\s*\()\s*['"][^'"]*(?:apps\/(?:api|mcp)|@modelcontextprotocol|\bhono\b|\bdrizzle-orm\b)[^'"]*['"]/g

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? sourceFiles(path) : /\.[cm]?tsx?$/.test(entry.name) ? [path] : []
  })
}

function verifyImports(base: string, pattern: RegExp, message: string): void {
  const violations = sourceFiles(base).flatMap(path => {
    const text = readFileSync(path, 'utf8')
    pattern.lastIndex = 0
    return [...text.matchAll(pattern)].map(match => `${relative(root, path)}: ${match[0]}`)
  })
  if (violations.length) throw new Error(`${message}\n${violations.join('\n')}`)
}

// Dependências workspace são dirigidas para baixo: app -> aplicação compartilhada -> catálogo.
const workspacePackages = new Map<string, { dependencies: string[]; path: string }>()
for (const area of ['apps', 'packages']) {
  for (const entry of readdirSync(join(root, area), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const packagePath = join(root, area, entry.name, 'package.json')
    try {
      const manifest = JSON.parse(readFileSync(packagePath, 'utf8')) as { name?: string; dependencies?: Record<string, string> }
      if (manifest.name) workspacePackages.set(manifest.name, {
        path: relative(root, packagePath),
        dependencies: Object.keys(manifest.dependencies ?? {}).filter(name => name.startsWith('@azy-board/')),
      })
    } catch { /* Diretório auxiliar sem package.json. */ }
  }
}

const visiting = new Set<string>()
const visited = new Set<string>()
function visitPackage(name: string, chain: string[] = []): void {
  if (visiting.has(name)) throw new Error(`Ciclo entre pacotes workspace: ${[...chain, name].join(' → ')}`)
  if (visited.has(name)) return
  const current = workspacePackages.get(name)
  if (!current) throw new Error(`Dependência workspace não encontrada: ${name}`)
  visiting.add(name)
  for (const dependency of current.dependencies) visitPackage(dependency, [...chain, name])
  visiting.delete(name)
  visited.add(name)
}

function verifyPackageCycle(): void {
  for (const name of ['@azy-board/api', '@azy-board/mcp', '@azy-board/tool-execution']) visitPackage(name)
  const apiManifest = JSON.parse(readFileSync(join(root, 'apps/api/package.json'), 'utf8')) as { dependencies?: Record<string, string> }
  if (apiManifest.dependencies?.['@azy-board/mcp'] || apiManifest.dependencies?.['@modelcontextprotocol/sdk']) {
    throw new Error('apps/api/package.json não pode depender do transporte/SDK MCP.')
  }
  if (workspacePackages.get('@azy-board/tool-execution')?.dependencies.some(name => name !== '@azy-board/tool-registry')) {
    throw new Error('tool-execution deve depender somente do tool-registry entre os pacotes workspace.')
  }
}

async function buildAndBootIsolatedApi(): Promise<void> {
  const stagingRoot = mkdtempSync(join('/tmp/opencode', 'azy-api-no-mcp-'))
  try {
    const stagedApi = join(stagingRoot, 'apps/api')
    cpSync(join(root, 'apps/api/src'), join(stagedApi, 'src'), { recursive: true })
    // Este node_modules contém somente as dependências declaradas pela API;
    // não inclui o workspace apps/mcp nem o SDK MCP.
    symlinkSync(join(root, 'apps/api/node_modules'), join(stagingRoot, 'node_modules'), 'dir')
    const environment = {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: join(stagingRoot, 'api.sqlite'),
      AZYBOARD_INSTANCE_DIR: join(stagingRoot, 'instance'),
      AZYBOARD_INSTALL_PROFILE: 'SIMPLE',
      JWT_SECRET: randomUUID(),
    }

    const migration = Bun.spawnSync(['bun', 'run', 'src/db/migrate.ts'], {
      cwd: stagedApi, env: environment, stdout: 'pipe', stderr: 'pipe',
    })
    if (migration.exitCode !== 0) throw new Error(`Migração isolada falhou:\n${migration.stderr.toString()}`)

    const build = Bun.spawnSync([
      'bun', 'build', 'apps/api/src/index.ts', '--outdir', 'apps/api/dist', '--target', 'bun', '--external', 'sharp',
    ], { cwd: stagingRoot, stdout: 'pipe', stderr: 'pipe' })
    if (build.exitCode !== 0) throw new Error(`Build isolado falhou:\n${build.stderr.toString()}`)

    const bundle = readFileSync(join(stagedApi, 'dist/index.js'), 'utf8')
    if (bundle.includes('apps/mcp/src/')) throw new Error('O bundle isolado ainda contém fontes do app MCP.')

    const port = 32_000 + Math.floor(Math.random() * 12_000)
    const instanceDir = join(stagingRoot, 'instance')
    const server = Bun.spawn(['bun', 'run', 'apps/api/dist/index.js'], {
      cwd: stagingRoot,
      env: {
        ...environment,
        AZYBOARD_INSTANCE_DIR: instanceDir,
        PORT: String(port),
      },
      stdout: 'inherit',
      stderr: 'inherit',
    })
    try {
      let live = false
      for (let attempt = 0; attempt < 50; attempt += 1) {
        if (server.exitCode !== null) break
        try {
          const response = await fetch(`http://127.0.0.1:${port}/health/live`, { signal: AbortSignal.timeout(500) })
          if (response.status === 200) { live = true; break }
        } catch { /* Servidor ainda está inicializando. */ }
        await Bun.sleep(100)
      }
      if (!live) throw new Error('API isolada não ficou live sem fontes MCP.')
    } finally {
      server.kill('SIGTERM')
      await server.exited
    }
  } finally {
    rmSync(stagingRoot, { recursive: true, force: true })
  }
}

async function main(): Promise<void> {
  verifyImports(join(root, 'apps/api/src'), forbiddenApiImports, 'A API tem import de transporte MCP:')
  verifyImports(join(root, 'packages/tool-execution/src'), forbiddenExecutionImports, 'tool-execution tem dependência de app/framework/driver:')
  verifyPackageCycle()
  await buildAndBootIsolatedApi()
  console.log('Fronteira API/tool-execution OK; API compilada e inicializada sem fontes apps/mcp.')
}

await main()
