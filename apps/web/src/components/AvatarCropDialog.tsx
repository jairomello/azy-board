import { useCallback, useEffect, useState, type ComponentType } from 'react'
import CropperDefault from 'react-easy-crop'
import 'react-easy-crop/react-easy-crop.css'
import { useTranslation } from 'react-i18next'
import { Loader2, X } from 'lucide-react'
import { renderCroppedAvatar, type PixelCrop } from '../lib/avatarImage'

// A tipagem publicada do react-easy-crop conflita com os tipos do React 18 do projeto.
const Cropper = CropperDefault as unknown as ComponentType<Record<string, unknown>>

interface Props {
  open: boolean
  imageSrc: string | null
  saving?: boolean
  onCancel: () => void
  onConfirm: (blob: Blob) => void
}

export function AvatarCropDialog({ open, imageSrc, saving = false, onCancel, onConfirm }: Props) {
  const { t } = useTranslation('settings')
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedPixels, setCroppedPixels] = useState<PixelCrop | null>(null)
  const [processing, setProcessing] = useState(false)

  const handleCropComplete = useCallback((_area: unknown, areaPixels: unknown) => {
    setCroppedPixels(areaPixels as PixelCrop)
  }, [])

  useEffect(() => {
    if (!open) {
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setCroppedPixels(null)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onCancel])

  if (!open || !imageSrc) return null

  const busy = saving || processing

  async function handleConfirm() {
    if (!imageSrc || !croppedPixels) return
    setProcessing(true)
    try {
      const blob = await renderCroppedAvatar(imageSrc, croppedPixels)
      onConfirm(blob)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('photoEditorTitle')}
    >
      <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-xl p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="font-semibold text-foreground">{t('photoEditorTitle')}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{t('photoEditorHint')}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label={t('photoEditorCancel')}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="relative w-full h-64 bg-black rounded-lg overflow-hidden">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={0}
            aspect={1}
            minZoom={1}
            maxZoom={3}
            cropShape="round"
            showGrid={false}
            zoomSpeed={1}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={handleCropComplete}
            style={{}}
            classes={{}}
            restrictPosition
            mediaProps={{}}
            cropperProps={{}}
            keyboardStep={1}
          />
        </div>

        <label className="flex items-center gap-3 mt-4 text-xs text-muted-foreground">
          <span className="sr-only">{t('photoEditorZoom')}</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            aria-label={t('photoEditorZoom')}
            className="w-full accent-[hsl(var(--primary))]"
          />
        </label>

        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-border text-foreground hover:bg-muted transition disabled:opacity-50"
          >
            {t('photoEditorCancel')}
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={busy || !croppedPixels}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 transition disabled:opacity-50"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {t('photoEditorApply')}
          </button>
        </div>
      </div>
    </div>
  )
}
