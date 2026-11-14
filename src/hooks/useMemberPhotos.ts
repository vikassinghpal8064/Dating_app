import { useCallback, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/authContext'
import { processImageForUpload, sniffImageType } from '../utils/photoPipeline'
import { FORMAT_EXTENSION, FORMAT_MIME } from '../utils/photoPipeline'
import type { EncodedFormat, SniffedImageType } from '../utils/photoPipeline'
import type { MemberPhoto } from '../types'

/**
 * The member's own uploads: load, upload with real progress, delete, reorder.
 *
 * Uploads go through the storage API's signed upload URL and an XMLHttpRequest
 * PUT so the progress bar reflects actual bytes sent, not an optimistic guess.
 * Only then is the row recorded via `record_member_photo`, which runs the
 * moderation auto-checks (declared mimetype must match the extension — WebP or
 * JPEG — and the size budget) and assigns the next display position. Deletes run the RPC first — deleting the row is the
 * security-relevant act — and best-effort remove the object afterwards.
 *
 * `moderation_status` starts at `pending` exactly as the table default demands;
 * the owner sees their photo immediately, everyone else only after approval.
 */

export interface OwnPhoto extends MemberPhoto {
  /** Signed URL for the owner's own rendering; null when signing failed. */
  signedUrl: string | null
}

export interface UploadProgress {
  /** 0–100. */
  percent: number
  /** The 0-based index of the photo being uploaded, for the thumbnail. */
  index: number
}

interface MemberPhotosState {
  photos: OwnPhoto[]
  loading: boolean
  error: string | null
}

export function useMemberPhotos() {
  const { user, refreshProfile } = useAuth()
  const [state, setState] = useState<MemberPhotosState>({ photos: [], loading: true, error: null })
  const [progress, setProgress] = useState<UploadProgress | null>(null)

  const load = useCallback(async () => {
    if (!user) return

    setState((current) => ({ ...current, loading: true, error: null }))

    const { data, error } = await supabase
      .from('member_photos')
      .select('*')
      .eq('user_id', user.id)
      .order('position', { ascending: true })

    if (error) {
      setState({ photos: [], loading: false, error: error.message })
      return
    }

    const rows = (data ?? []) as MemberPhoto[]
    const signed = await Promise.all(
      rows.map(async (row) => {
        const { data: signedData } = await supabase.storage
          .from('profile-photos')
          .createSignedUrl(row.storage_path, 3600)
        return { ...row, signedUrl: signedData?.signedUrl ?? null }
      })
    )

    setState({ photos: signed, loading: false, error: null })
  }, [user])

  const upload = useCallback(
    async (file: File) => {
      if (!user) return { error: 'You need to be signed in to upload a photo.' as string | null }

      let sourceType: SniffedImageType
      try {
        const sniffed = await sniffImageType(file)
        if (!sniffed) {
          return {
            error:
              'That file is not a real photo. Please choose a JPEG, PNG or WebP image (renaming a file does not change what is inside it).',
          }
        }
        sourceType = sniffed
      } catch {
        return { error: 'That file could not be read. Please try another photo.' }
      }

      let webp: Blob
      let format: EncodedFormat = 'webp'
      try {
        const processed = await processImageForUpload(file, sourceType)
        webp = processed.blob
        format = processed.format
      } catch (error) {
        return {
          error:
            error instanceof Error
              ? error.message
              : 'That photo could not be compressed. Please try a smaller one.',
        }
      }

      if (webp.size > 250 * 1024) {
        return { error: 'That photo is still too large after compression. Please try another one.' }
      }

      // The path is <uid>/<uuid>.<ext> — the shape record_member_photo validates.
      // WebP where this engine can encode it, JPEG where it cannot (WebKit).
      const path = `${user.id}/${crypto.randomUUID()}.${FORMAT_EXTENSION[format]}`
      const { data: signed, error: signedError } = await supabase.storage
        .from('profile-photos')
        .createSignedUploadUrl(path)

      if (signedError || !signed) {
        return { error: 'We could not prepare your upload. Please try again.' }
      }

      // A real progress read requires the browser's own request machinery.
      const putError = await new Promise<string | null>((resolve) => {
        const request = new XMLHttpRequest()
        request.open('PUT', signed.signedUrl)
        request.responseType = 'text'
        request.setRequestHeader('content-type', FORMAT_MIME[format])
        request.setRequestHeader('x-upsert', 'false')

        request.upload.onprogress = (event) => {
          if (event.lengthComputable && event.total > 0) {
            setProgress({ percent: Math.round((event.loaded / event.total) * 100), index: state.photos.length })
          }
        }
        request.onerror = () => resolve('The upload failed. Check your connection and try again.')
        request.onabort = () => resolve('The upload was interrupted.')
        request.onload = () => {
          // 200 and 201 both mean the object exists now; 4xx means it was
          // refused (wrong bucket, over limit, blocked by policy).
          if (request.status >= 200 && request.status < 300) resolve(null)
          else if (request.status === 413) resolve('That photo is over the size limit.')
          else resolve(`The upload was refused (${request.status}). Please try again.`)
        }
        request.send(webp)
      })

      setProgress(null)
      if (putError) return { error: putError }

      const { data, error: rpcError } = await supabase.rpc('record_member_photo', {
        photo_path: path,
      })

      if (rpcError) {
        // The object exists but no row was recorded; remove the stray file.
        await supabase.storage.from('profile-photos').remove([path])
        return { error: 'Your photo was uploaded but could not be saved. Please try again.' }
      }

      const recorded = data as MemberPhoto | null
      if (recorded) {
        const signedUrl = await signOwnPath(recorded.storage_path)
        setState((current) => ({
          ...current,
          photos: [...current.photos, { ...recorded, signedUrl }],
        }))
      }
      await refreshProfile()
      return { error: null, status: recorded?.moderation_status ?? 'pending' as string | null }
    },
    [user, state.photos.length, refreshProfile]
  )

  const remove = useCallback(
    async (photoId: string, storagePath: string) => {
      const { error } = await supabase.rpc('delete_member_photo', { photo_id: photoId })
      if (error) return { error: error.message }

      // Best effort: the row is gone either way, so a stray object is a
      // storage-only leak the moderator queue still keeps private.
      await supabase.storage.from('profile-photos').remove([storagePath])

      setState((current) => ({
        ...current,
        photos: current.photos.filter((photo) => photo.id !== photoId),
      }))
      await refreshProfile()
      return { error: null }
    },
    [refreshProfile]
  )

  const reorder = useCallback(
    async (orderedIds: string[]): Promise<{ error: string | null }> => {
      const positions = orderedIds.map((_, index) => index)
      const { error } = await supabase.rpc('reorder_member_photos', {
        photo_ids: orderedIds,
        positions,
      })
      if (error) return { error: error.message }

      setState((current) => {
        const byId = new Map(current.photos.map((photo) => [photo.id, photo]))
        const reordered = orderedIds
          .map((id, index) => {
            const photo = byId.get(id)
            return photo ? { ...photo, position: index } : null
          })
          .filter((photo): photo is OwnPhoto => photo !== null)
        return { ...current, photos: reordered }
      })
      return { error: null }
    },
    []
  )

  return { photos: state.photos, loading: state.loading, error: state.error, progress, load, upload, remove, reorder }
}

async function signOwnPath(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from('profile-photos').createSignedUrl(path, 3600)
  return data?.signedUrl ?? null
}