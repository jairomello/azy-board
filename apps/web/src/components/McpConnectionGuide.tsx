import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy, Link2, Sparkles } from 'lucide-react'
import { copyTextToClipboard } from '../lib/clipboard'
import { resolveMcpUrl } from '../lib/mcpUrl'

type CopyTarget = 'url' | 'instruction'

// Orientação de conexão do MCP exibida no topo da seção de API Keys: explica a
// finalidade da chave, mostra a URL do MCP da instalação e oferece a cópia da
// URL e da instrução pronta para o code agent. Nunca exibe o valor da chave.
export function McpConnectionGuide() {
  const { t } = useTranslation('settings')
  const mcpUrl = resolveMcpUrl()

  const [copied, setCopied] = useState<CopyTarget | null>(null)
  const [failed, setFailed] = useState(false)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
  }, [])

  async function handleCopy(target: CopyTarget, text: string) {
    const ok = await copyTextToClipboard(text)
    if (!ok) {
      // Mantém a URL visível/selecionável e comunica a falha sem travar a tela.
      setCopied(null)
      setFailed(true)
      return
    }
    setFailed(false)
    setCopied(target)
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    copyTimerRef.current = setTimeout(() => setCopied(null), 2000)
  }

  const statusMessage = copied === 'url'
    ? t('mcpGuideUrlCopied')
    : copied === 'instruction'
      ? t('mcpGuideInstructionCopied')
      : ''

  function copyButtonClass(target: CopyTarget) {
    return `flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border bg-background transition flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
      copied === target ? 'border-green-500/60 text-green-700 dark:text-green-400' : 'border-border hover:bg-muted'
    }`
  }

  return (
    <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 mb-4">
      <div className="flex items-start gap-2">
        <Link2 className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-foreground">{t('mcpGuideIntro')}</p>

          <p className="text-xs font-semibold text-muted-foreground mt-3 mb-1">{t('mcpGuideUrlLabel')}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 text-xs font-mono break-all select-all rounded border border-border bg-background px-2 py-1.5 text-foreground">
              {mcpUrl}
            </code>
            <button
              type="button"
              onClick={() => void handleCopy('url', mcpUrl)}
              className={copyButtonClass('url')}
            >
              {copied === 'url' ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
              {copied === 'url' ? t('mcpGuideUrlCopied') : t('mcpGuideCopyUrl')}
            </button>
          </div>

          <button
            type="button"
            onClick={() => void handleCopy('instruction', t('mcpGuideInstruction', { url: mcpUrl }))}
            className={`${copyButtonClass('instruction')} mt-2`}
          >
            {copied === 'instruction' ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
            {copied === 'instruction' ? t('mcpGuideInstructionCopied') : t('mcpGuideCopyInstruction')}
          </button>

          <span role="status" aria-live="polite" className="sr-only">{statusMessage}</span>

          <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="w-3.5 h-3.5 mt-px flex-shrink-0" aria-hidden="true" />
            <span>{t('mcpGuideSkillHint', { command: t('mcpGuideSkillCommand') })}</span>
          </p>

          {failed && (
            <p role="alert" className="text-xs text-red-600 dark:text-red-400 mt-2">{t('mcpGuideCopyFailed')}</p>
          )}
        </div>
      </div>
    </div>
  )
}
