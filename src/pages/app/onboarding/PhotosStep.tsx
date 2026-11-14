import { useMemo, useRef, useState } from 'react'
import { GripVertical, ImagePlus, Loader2, Lock, Star, Trash2 } from 'lucide-react'
import type { OwnPhoto, UploadProgress } from '../../../hooks/useMemberPhotos'
import { progressLabel } from '../../../utils/onboardingSchemas'
import type { StepProps } from './types'

const MIN_PHOTOS = 2
const MAX_PHOTOS = 6
const ACCEPTED = 'image/jpeg,image/png,image/webp'

interface PhotosStepProps extends StepProps {
  photos: OwnPhoto[]
  photosLoading: boolean
  photosError: string | null
  pastedPhotoCount: number
  uploadProgress: UploadProgress | null
  uploading: boolean
  onUpload: (file: File) => Promise<{ error: string | null }>
  onDelete: (id: string, path: string) => Promise<{ error: string | null }>
  onReorder: (orderedIds: string[]) => Promise<{ error: string | null }>
}

/**
 * Step 6 — your photos. At least two, at most six; the first one is your main
 * photo. Files are re-encoded (WebP where the engine can encode it, otherwise
 * JPEG) and stripped of EXIF/GPS before upload,
 * and each upload needs the moderation gate: pending photos show only to you
 * until the auto-checks approve them.
 */
export function PhotosStep({
  photos,
  photosLoading,
  photosError,
  pastedPhotoCount,
  uploadProgress,
  uploading,
  onUpload,
  onDelete,
  onReorder,
  errors,
  savedAt,
  saving,
}: PhotosStepProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  /**
   * Uploads a batch of files, surfacing the first rejection the pipeline
   * reports instead of swallowing it: a renamed `.exe` should tell the owner
   * it was refused, not vanish silently.
   */
  const uploadFiles = async (files: File[]) => {
    setUploadError(null)
    for (const file of files) {
      const result = await onUpload(file)
      if (result?.error) {
        setUploadError(result.error)
      }
    }
  }

  const total = photos.length + pastedPhotoCount
  const needsMore = total < MIN_PHOTOS
  const atCap = photos.length >= MAX_PHOTOS

  const ordered = useMemo(() => [...photos].sort((a, b) => a.position - b.position), [photos])

  const move = (index: number, delta: -1 | 1) => {
    const swap = index + delta
    if (swap < 0 || swap >= ordered.length) return
    const next = ordered.map((photo) => photo.id)
    ;[next[index], next[swap]] = [next[swap], next[index]]
    void onReorder(next)
  }

  const handleDrop = (toIndex: number) => {
    if (dragIndex === null || dragIndex === toIndex) {
      setDragIndex(null)
      return
    }
    const next = ordered.map((photo) => photo.id)
    const [moved] = next.splice(dragIndex, 1)
    next.splice(toIndex, 0, moved)
    setDragIndex(null)
    void onReorder(next)
  }

  return (
    <div className="space-y-5">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        multiple
        className="sr-only"
        aria-label="Add photos"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          event.target.value = ''
          void uploadFiles(files)
        }}
      />

      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-dark-300" aria-live="polite">
          {needsMore
            ? `Add at least ${MIN_PHOTOS - total} more photo${total >= MIN_PHOTOS - 1 ? '' : 's'}`
            : `${total} of ${MAX_PHOTOS} photos`}
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={atCap || uploading}
          className="inline-flex items-center gap-2 rounded-xl border border-primary-500/50 px-4 py-2 text-sm font-medium text-primary-400 transition hover:bg-primary-600/15 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-400"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ImagePlus className="h-4 w-4" aria-hidden="true" />}
          {uploading ? 'Uploading…' : atCap ? 'Photo limit reached' : 'Add photos'}
        </button>
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-label="Drag photos here or press Enter to browse"
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            inputRef.current?.click()
          }
        }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragOver(false)
          void uploadFiles(Array.from(event.dataTransfer.files ?? []))
        }}
        className={
          dragOver
            ? 'flex min-h-32 items-center justify-center rounded-2xl border-2 border-dashed border-primary-500 bg-primary-600/10 transition'
            : 'flex min-h-32 cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-dark-700 bg-dark-900/40 transition hover:border-primary-500/40'
        }
      >
        <p className="px-4 text-center text-sm text-dark-400">
          Drag photos here, or click to browse. JPEG, PNG or WebP — anything else is rejected.
        </p>
      </div>

      {uploadProgress && (
        <div aria-live="polite">
          <p className="text-xs text-dark-400">{progressLabel(uploadProgress.percent)}</p>
          <div
            className="mt-1 h-1.5 overflow-hidden rounded-full bg-dark-800"
            role="progressbar"
            aria-valuenow={uploadProgress.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Photo upload progress"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-600 transition-[width] duration-200"
              style={{ width: `${uploadProgress.percent}%` }}
            />
          </div>
        </div>
      )}

      {photosError && (
        <p className="text-sm text-red-400" role="alert">
          {photosError}
        </p>
      )}
      {uploadError && (
        <p className="text-sm text-red-400" role="alert">
          {uploadError}
        </p>
      )}
      {errors.photos && (
        <p className="text-sm text-red-400" role="alert">
          {errors.photos}
        </p>
      )}
      {pastedPhotoCount > 0 && (
        <p className="text-xs text-dark-500">
          {pastedPhotoCount} pasted URL photo{pastedPhotoCount === 1 ? '' : 's'} from your profile are also counted.
        </p>
      )}

      {photosLoading ? (
        <PhotoGridSkeleton />
      ) : photos.length === 0 ? (
        <div className="rounded-2xl border border-dark-700 bg-dark-900/60 p-6 text-center">
          <Lock className="mx-auto h-6 w-6 text-primary-400" aria-hidden="true" />
          <p className="mt-2 text-sm text-dark-300">No photos yet.</p>
          <p className="mt-1 text-xs leading-relaxed text-dark-500">
            Photos stay private until you approve them for sharing — and every file is checked
            before it is visible to anyone else.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-3 gap-3" aria-label="Your photos">
          {ordered.map((photo, index) => (
            <PhotoTile
              key={photo.id}
              photo={photo}
              index={index}
              total={ordered.length}
              canMoveLeft={index > 0}
              canMoveRight={index < ordered.length - 1}
              onMoveLeft={() => move(index, -1)}
              onMoveRight={() => move(index, 1)}
              onDelete={() => void onDelete(photo.id, photo.storage_path)}
              onDragStart={() => setDragIndex(index)}
              onDragOver={() => setDragIndex((current) => current ?? index)}
              onDrop={() => handleDrop(index)}
            />
          ))}
        </ul>
      )}

      <p className="flex items-start gap-2 rounded-xl border border-dark-700 bg-dark-900/60 p-3 text-xs leading-relaxed text-dark-500">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-400" aria-hidden="true" />
        <span>Your main photo is the first one you see in other people&apos;s feeds. Photos are stored privately and re-encoded to strip location data before they ever touch our servers.</span>
      </p>

      <SaveStatus saving={saving} savedAt={savedAt} />
    </div>
  )
}

function PhotoTile({
  photo,
  index,
  total,
  canMoveLeft,
  canMoveRight,
  onMoveLeft,
  onMoveRight,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  photo: OwnPhoto
  index: number
  total: number
  canMoveLeft: boolean
  canMoveRight: boolean
  onMoveLeft: () => void
  onMoveRight: () => void
  onDelete: () => void
  onDragStart: () => void
  onDragOver: () => void
  onDrop: () => void
}) {
  return (
    <li
      draggable
      onDragStart={onDragStart}
      onDragOver={(event) => {
        event.preventDefault()
        onDragOver()
      }}
      onDrop={(event) => {
        event.preventDefault()
        onDrop()
      }}
      className="group relative overflow-hidden rounded-xl border border-dark-700 bg-dark-900"
    >
      <div className="relative aspect-[3/4]">
        {photo.signedUrl ? (
          <img
            src={photo.signedUrl}
            alt={`Photo ${index + 1} of ${total}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-dark-800 text-dark-600">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          </div>
        )}
        {photo.moderation_status !== 'approved' && (
          <span className="absolute left-1.5 top-1.5 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-300">
            {photo.moderation_status === 'pending' ? 'Pending review' : 'Rejected'}
          </span>
        )}

        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent p-1.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={onMoveLeft}
              disabled={!canMoveLeft}
              className="rounded-md bg-black/50 p-1 text-dark-200 transition hover:bg-black/80 disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-primary-400"
              aria-label="Move photo left"
            >
              <span aria-hidden="true" className="block h-3 w-3 rotate-45 border-l-2 border-t-2" />
            </button>
            <button
              type="button"
              onClick={onMoveRight}
              disabled={!canMoveRight}
              className="rounded-md bg-black/50 p-1 text-dark-200 transition hover:bg-black/80 disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-primary-400"
              aria-label="Move photo right"
            >
              <span aria-hidden="true" className="block h-3 w-3 -rotate-45 border-r-2 border-t-2" />
            </button>
          </div>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-md bg-black/50 p-1 text-red-300 transition hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-primary-400"
            aria-label="Delete photo"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        {index === 0 && (
          <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-primary-600/90 px-2 py-0.5 text-[10px] font-medium text-white">
            <Star className="h-3 w-3" aria-hidden="true" />
            Main
          </span>
        )}
        <span className="absolute left-1.5 bottom-1.5 text-[10px] text-white/80" aria-hidden="true">
          <GripVertical className="h-3.5 w-3.5" />
        </span>
      </div>
    </li>
  )
}

function PhotoGridSkeleton() {
  return (
    <ul className="grid grid-cols-3 gap-3" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <li key={index} className="overflow-hidden rounded-xl bg-dark-800">
          <div className="aspect-[3/4] animate-pulse bg-dark-800" />
        </li>
      ))}
    </ul>
  )
}

function SaveStatus({ saving, savedAt }: { saving: boolean; savedAt: number | null }) {
  if (saving) return <p className="text-xs text-dark-500" aria-live="polite">Saving…</p>
  if (savedAt !== null) return <p className="text-xs text-emerald-400" aria-live="polite">Saved</p>
  return <p className="text-xs text-dark-600" aria-live="polite">Your changes save as you go.</p>
}