import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Image as ImageIcon, MapPin, Plus, Trash2, User } from 'lucide-react'
import {
  Button,
  Checkbox,
  InlineMessage,
  Input,
  PageContainer,
  PageHeader,
  PageSpinner,
  Textarea,
  Toggle,
} from '../../components/ui'
import { useAuth } from '../../lib/authContext'
import { MAX_PHOTOS, profileSchema } from '../../utils/validation'
import type { UserProfile } from '../../types'

const INTEREST_CHOICES = [
  { value: 'female', label: 'Women' },
  { value: 'male', label: 'Men' },
  { value: 'non_binary', label: 'Non-binary people' },
  { value: 'everyone', label: 'Everyone' },
] as const

const VALID_INTERESTS: readonly string[] = INTEREST_CHOICES.map((choice) => choice.value)

interface FormState {
  fullName: string
  bio: string
  locationCity: string
  locationCountry: string
  showDistance: boolean
  interestedIn: string[]
  photos: string[]
}

function toFormState(user: UserProfile): FormState {
  return {
    fullName: user.full_name ?? '',
    bio: user.bio ?? '',
    locationCity: user.location_city ?? '',
    locationCountry: user.location_country ?? '',
    showDistance: user.show_distance ?? true,
    interestedIn: (user.interested_in ?? []).filter((value) =>
      (VALID_INTERESTS as readonly string[]).includes(value)
    ),
    photos: user.photos ?? [],
  }
}

export function EditProfilePage() {
  const navigate = useNavigate()
  const { user, loading, updateProfile, refreshProfile } = useAuth()

  const [form, setForm] = useState<FormState | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user && form === null) setForm(toFormState(user))
  }, [user, form])

  if (loading || !form) {
    return (
      <PageContainer variant="narrow">
        <div className="flex flex-col items-center gap-4 py-20" role="status">
          <PageSpinner size="lg" variant="primary" />
          <p className="text-sm text-dark-400">Loading your profile…</p>
        </div>
      </PageContainer>
    )
  }

  function toggleInterest(value: string) {
    setSaved(false)
    setForm((current) => {
      if (!current) return current
      const selected = current.interestedIn.includes(value)
      return {
        ...current,
        interestedIn: selected
          ? current.interestedIn.filter((item) => item !== value)
          : [...current.interestedIn, value],
      }
    })
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!form) return

    const parsed = profileSchema.safeParse({
      fullName: form.fullName,
      bio: form.bio,
      locationCity: form.locationCity,
      locationCountry: form.locationCountry,
      showDistance: form.showDistance,
      interestedIn: form.interestedIn,
      photos: form.photos.filter((url) => url.trim() !== ''),
    })

    if (!parsed.success) {
      const next: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form')
        // A `photos` issue carries the failing index in path[1], so the message
        // can be attached to the specific URL field rather than the section.
        if (key === 'photos') {
          next[`photos.${String(issue.path[1] ?? 0)}`] = issue.message
        }
        if (!next[key]) next[key] = issue.message
      }
      setFieldErrors(next)
      setFormError('Fix the highlighted fields and try again.')
      setSaved(false)
      return
    }

    setFieldErrors({})
    setFormError('')
    setSaving(true)

    const { error } = await updateProfile({
      full_name: parsed.data.fullName,
      bio: parsed.data.bio ?? '',
      location_city: parsed.data.locationCity,
      location_country: parsed.data.locationCountry,
      show_distance: parsed.data.showDistance,
      interested_in: parsed.data.interestedIn,
      photos: parsed.data.photos,
    })

    setSaving(false)

    if (error) {
      setFormError(error.message)
      setSaved(false)
      return
    }

    await refreshProfile()
    setSaved(true)
  }

  return (
    <PageContainer variant="narrow">
      <button
        type="button"
        onClick={() => navigate('/app/me')}
        className="mb-6 inline-flex items-center gap-2 rounded-lg text-sm text-dark-400 transition-colors hover:text-dark-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to Me
      </button>

      <PageHeader
        title="Edit profile"
        subtitle="These are the fields other members can see. Email, date of birth, photo verification and your exact location cannot be edited here."
      />

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {formError && <InlineMessage tone="error">{formError}</InlineMessage>}
        {saved && !formError && (
          <InlineMessage tone="success">Your profile has been saved.</InlineMessage>
        )}

        <section className="glass rounded-2xl p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-dark-50">
            <User className="h-5 w-5 text-primary-400" aria-hidden="true" />
            About you
          </h2>

          <div className="mt-4 space-y-4">
            <Input
              label="Display name"
              autoComplete="name"
              required
              value={form.fullName}
              error={fieldErrors.fullName}
              onChange={(event) => {
                setSaved(false)
                setForm({ ...form, fullName: event.target.value })
              }}
            />

            <div>
              <Textarea
                label="Bio"
                rows={5}
                maxLength={500}
                value={form.bio}
                error={fieldErrors.bio}
                helperText={`${form.bio.length}/500 characters. Say what you are actually looking for.`}
                onChange={(event) => {
                  setSaved(false)
                  setForm({ ...form, bio: event.target.value })
                }}
              />
            </div>
          </div>
        </section>

        <section className="glass rounded-2xl p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-dark-50">
            <ImageIcon className="h-5 w-5 text-primary-400" aria-hidden="true" />
            Photos
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-dark-400">
            Up to {MAX_PHOTOS} images, listed in the order they should appear. Paste a direct
            image URL — the file must be served over https, and the storage bucket is what decides
            who can read it. This build has no upload widget, so no file ever passes through the
            browser to us.
          </p>

          {form.photos.length > 0 && (
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {form.photos.map((photo, index) => (
                <li key={`${index}-${photo}`} className="space-y-1.5">
                  <div className="relative aspect-square overflow-hidden rounded-xl ring-1 ring-dark-700">
                    <img
                      src={photo}
                      alt={`Your photo ${index + 1} preview`}
                      loading="lazy"
                      className="h-full w-full object-cover"
                      // A remote URL may 404 or be blocked; never let a broken
                      // photo leave an empty frame on the edit screen.
                      onError={(event) => {
                        event.currentTarget.style.visibility = 'hidden'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setSaved(false)
                        setForm({
                          ...form,
                          photos: form.photos.filter((_, i) => i !== index),
                        })
                      }}
                      className="absolute right-1.5 top-1.5 rounded-lg bg-dark-950/80 p-1.5 text-red-300 transition hover:bg-red-500/80 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="sr-only">Remove photo {index + 1}</span>
                    </button>
                  </div>
                  <Input
                    label={`Photo ${index + 1} URL`}
                    inputMode="url"
                    spellCheck={false}
                    value={photo}
                    error={fieldErrors[`photos.${index}`]}
                    onChange={(event) => {
                      setSaved(false)
                      const next = [...form.photos]
                      next[index] = event.target.value
                      setForm({ ...form, photos: next })
                    }}
                  />
                </li>
              ))}
            </ul>
          )}

          {form.photos.length < MAX_PHOTOS && (
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              onClick={() => {
                setSaved(false)
                setForm({ ...form, photos: [...form.photos, ''] })
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add a photo
            </Button>
          )}

          {fieldErrors.photos && (
            <p className="mt-2 text-sm text-red-400" role="alert">
              {fieldErrors.photos}
            </p>
          )}
        </section>

        <section className="glass rounded-2xl p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-dark-50">
            <MapPin className="h-5 w-5 text-primary-400" aria-hidden="true" />
            Where you are
          </h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Input
              label="City"
              autoComplete="address-level2"
              required
              value={form.locationCity}
              error={fieldErrors.locationCity}
              onChange={(event) => {
                setSaved(false)
                setForm({ ...form, locationCity: event.target.value })
              }}
            />
            <Input
              label="Country"
              autoComplete="country-name"
              required
              value={form.locationCountry}
              error={fieldErrors.locationCountry}
              onChange={(event) => {
                setSaved(false)
                setForm({ ...form, locationCountry: event.target.value })
              }}
            />
          </div>

          <p className="mt-4 text-xs leading-relaxed text-dark-500">
            Only your city and country are ever published. Your coordinates are stored rounded to
            two decimal places and are never returned to another member.
          </p>
        </section>

        <section className="glass rounded-2xl p-5">
          <h2 className="font-display text-lg font-semibold text-dark-50">Preferences</h2>

          <fieldset className="mt-4">
            <legend className="text-sm font-medium text-dark-300">Who are you interested in?</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {INTEREST_CHOICES.map((choice) => (
                <Checkbox
                  key={choice.value}
                  label={choice.label}
                  checked={form.interestedIn.includes(choice.value)}
                  onChange={() => toggleInterest(choice.value)}
                />
              ))}
            </div>
            {fieldErrors.interestedIn && (
              <p className="mt-2 text-sm text-red-400" role="alert">
                {fieldErrors.interestedIn}
              </p>
            )}
          </fieldset>

          <div className="mt-5">
            <Toggle
              label="Show my distance band"
              description="Others see a band such as “10 to 25 km away”, never a precise distance."
              checked={form.showDistance}
              onChange={(event) => {
                setSaved(false)
                setForm({ ...form, showDistance: event.target.checked })
              }}
            />
          </div>
        </section>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <Button type="button" variant="ghost" onClick={() => navigate('/app/me')} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>
    </PageContainer>
  )
}
