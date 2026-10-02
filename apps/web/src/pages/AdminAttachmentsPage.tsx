import { useTranslation } from 'react-i18next'
import { AppShell } from '../components/AppShell'
import { useAuth } from '../contexts/AuthContext'
import { AttachmentSettingsPanel } from '../components/AttachmentSettingsPanel'
import type { GlobalGroup } from '@azy-board/domain'

// A configuração de anexos pertence ao tenant (vale para toda a instalação),
// por isso vive na área de administração, acessível a MANAGER/ADMIN/ROOT.
const CAN_CONFIG_ATTACHMENTS: GlobalGroup[] = ['MANAGER', 'ADMIN', 'ROOT']

export default function AdminAttachmentsPage() {
  const { t } = useTranslation(['common', 'settings'])
  const { user } = useAuth()

  if (user && !CAN_CONFIG_ATTACHMENTS.includes(user.globalGroup)) {
    return <AppShell sectionLabel={t('common:admin')} contextLabel={t('settings:attachmentsTitle')}><div className="max-w-xl mx-auto py-12"><div role="alert" className="rounded-xl border border-border bg-card p-6 text-center"><h2 className="text-lg font-semibold text-foreground">{t('settings:accessDenied')}</h2><p className="text-sm text-muted-foreground mt-2">{t('settings:adminOnly')}</p></div></div></AppShell>
  }

  return (
    <AppShell sectionLabel={t('common:admin')} contextLabel={t('settings:attachmentsTitle')} contentClassName="overflow-y-auto">
      <div className="max-w-3xl mx-auto py-6 sm:py-9 space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">{t('common:admin')}</p>
          <h2 className="text-2xl font-bold text-foreground mt-1">{t('settings:attachmentsTitle')}</h2>
        </div>
        <AttachmentSettingsPanel />
      </div>
    </AppShell>
  )
}
