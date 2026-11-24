import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Contrato dos dois templates nginx versionados (standalone e atrás de
// Cloudflare): asset ausente é 404 real, asset existente tem cache longo e o
// index.html sempre revalida. Sem isso, um asset de build antigo volta como
// index.html (text/html) e o navegador recusa o módulo/CSS.

const ROOT = join(import.meta.dir, '..')
const TEMPLATES = [
  'docker/nginx-web.conf.template',
  'docker/nginx-web-cloudflare.conf.template',
]

function blockOf(source: string, header: string): string {
  const start = source.indexOf(header)
  if (start < 0) return ''
  const open = source.indexOf('{', start)
  const close = source.indexOf('}', open)
  return source.slice(start, close)
}

for (const relativePath of TEMPLATES) {
  describe(relativePath, () => {
    const source = readFileSync(join(ROOT, relativePath), 'utf8')

    test('assets com hash têm 404 real e cache longo', () => {
      const assets = blockOf(source, 'location /assets/')
      expect(assets).toContain('try_files $uri =404;')
      expect(assets).toContain('expires 1y;')
    })

    test('assets não declaram add_header que descarte os headers do server', () => {
      expect(blockOf(source, 'location /assets/')).not.toContain('add_header')
    })

    test('index.html exige revalidação', () => {
      const html = blockOf(source, 'location = /index.html')
      expect(html).toContain('expires -1;')
      expect(html).not.toContain('add_header')
    })

    test('fallback do SPA continua entregando index.html', () => {
      expect(source).toContain('try_files $uri $uri/ /index.html;')
    })

    test('headers de segurança seguem no nível do server', () => {
      for (const header of ['Content-Security-Policy', 'X-Frame-Options', 'X-Content-Type-Options', 'Referrer-Policy']) {
        expect(source).toContain(header)
      }
    })
  })
}
