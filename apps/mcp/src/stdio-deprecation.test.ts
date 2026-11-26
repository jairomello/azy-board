import { describe, expect, test } from 'bun:test'
import { fileURLToPath } from 'node:url'

// O stdio depende de API Key e está depreciado: ao iniciar, avisa no stderr
// (stdout é do protocolo) sem expor a chave.
describe('stdio depreciado', () => {
  test('avisa no stderr ao iniciar, sem vazar a chave', async () => {
    const entry = fileURLToPath(new URL('../mcp-server.ts', import.meta.url))
    const child = Bun.spawn(['bun', entry], {
      env: { ...process.env, EASYBOARD_API_KEY: 'azb_chave_de_teste_nao_real', EASYBOARD_URL: 'http://127.0.0.1:9' },
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const reader = child.stderr.getReader()
    let stderr = ''
    const deadline = Date.now() + 10_000
    while (!stderr.includes('depreciado') && Date.now() < deadline) {
      const chunk = await Promise.race([reader.read(), Bun.sleep(500).then(() => null)])
      if (chunk && !chunk.done) stderr += new TextDecoder().decode(chunk.value)
      if (chunk?.done) break
    }
    child.kill()
    expect(stderr).toContain('depreciado')
    expect(stderr).toContain('OAuth')
    expect(stderr).not.toContain('azb_chave_de_teste_nao_real')
  })
})
