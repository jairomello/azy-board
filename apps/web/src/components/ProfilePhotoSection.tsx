import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Camera, Loader2, Trash2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from './Toast'
import { UserAvatar } from './UserAvatar'
import { AvatarCropDialog } from './AvatarCropDialog'
import { isAcceptedAvatarFile, readFileAsDataUrl } from '../lib/avatarImage'

const ACCEPTED_TYPES = 'image/png,image/jpeg,image/webp,image/gif,image/avif,image/bmp'

export function ProfilePhotoSection() {
  const { t } = useTranslation('settings')
  const { user, updateAvatar, removeAvatar } = useAuth()
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Permite escolher o mesmo arquivo novamente depois.
    event.target.value = ''
    if (!file) return
    if (!isAcceptedAvatarFile(file)) {
      toast(t('profilePhotoInvalidType'), 'error')
      return
    }
    try {
      setImageSrc(await readFileAsDataUrl(file))
    } catch {
      toast(t('profilePhotoError'), 'error')
    }
  }

  async function handleConfirm(blob: Blob) {
    setSaving(true)
    try {
      await updateAvatar(blob)
      setImageSrc(null)
      toast(t('profilePhotoUpdated'))
    } catch {
      toast(t('profilePhotoError'), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove() {
    setRemoving(true)
    try {
      await removeAvatar()
      toast(t('profilePhotoRemoved'))
    } catch {
      toast(t('profilePhotoError'), 'error')
    } finally {
      setRemoving(false)
    }
  }

  const busy = saving || removing

  return (
    <section className="bg-card border border-border rounded-xl px-5 py-4 mb-5 shadow-sm">
      <div className="flex items-center gap-4">
        {user && <UserAvatar user={user} size="lg" />}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground truncate">{user?.name}</p>
          <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border border-border text-foreground hover:bg-muted transition disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
            {t('profilePhotoChange')}
          </button>
          {user?.avatarUrl && (
            <button
              type="button"
              onClick={() => void handleRemove()}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition disabled:opacity-50"
            >
              {removing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              {t('profilePhotoRemove')}
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-3">{t('profilePhotoHint')}</p>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        className="hidden"
        onChange={(event) => void handleFileChange(event)}
      />

      <AvatarCropDialog
        open={imageSrc !== null}
        imageSrc={imageSrc}
        saving={saving}
        onCancel={() => setImageSrc(null)}
        onConfirm={(blob) => void handleConfirm(blob)}
      />
    </section>
  )
}
