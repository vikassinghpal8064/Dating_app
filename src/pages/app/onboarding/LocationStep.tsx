import { useState } from 'react'
import { LocateFixed } from 'lucide-react'
import { CITIES, COUNTRIES, INDIAN_STATES } from '../../../data/onboardingOptions'
import { roundCoordinates } from '../../../utils/photoPipeline'
import { SuggestionInput } from './SuggestionInput'
import type { StepProps } from './types'

type LocationError = string | null

/**
 * Step 2 — where you are. The city/state/country fields are searchable but
 * accept any typed value, so the values set at sign-up survive resume. The
 * optional "use my current area" path rounds coordinates to exactly two
 * decimals before they enter the draft — the same rounding the database CHECK
 * enforces — so the stored value can never pin anyone down precisely.
 */
export function LocationStep({ draft, errors, update, savedAt, saving }: StepProps) {
  const [geoError, setGeoError] = useState<LocationError>(null)
  const [locating, setLocating] = useState(false)

  const coordsSet = draft.latitude !== null && draft.longitude !== null
  const geoApplied =
    draft.locationCity.trim() !== '' &&
    draft.locationCountry.trim() !== '' &&
    coordsSet

  const useCurrentArea = () => {
    if (!('geolocation' in navigator)) {
      setGeoError('Your browser does not support location sharing.')
      return
    }
    setLocating(true)
    setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const rounded = roundCoordinates(position.coords.latitude, position.coords.longitude)
        update({ latitude: rounded.latitude, longitude: rounded.longitude }, 'immediate')
        setLocating(false)
      },
      (error) => {
        setLocating(false)
        if (error.code === error.PERMISSION_DENIED) {
          setGeoError('Location permission was denied. You can still type your city below.')
        } else {
          setGeoError('We could not read your location just now. You can still type your city below.')
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    )
  }

  return (
    <div className="space-y-5">
      <SuggestionInput
        label="City"
        id="location-city"
        value={draft.locationCity}
        suggestions={CITIES}
        onChange={(value) => update({ locationCity: value }, 'debounced')}
        error={errors.locationCity}
        helperText="Searchable — or just type it."
        placeholder="e.g. Mumbai, Leeds, New York"
        required
        maxLength={120}
      />

      <SuggestionInput
        label="State or region"
        id="location-state"
        value={draft.locationState}
        suggestions={INDIAN_STATES}
        onChange={(value) => update({ locationState: value }, 'debounced')}
        error={errors.locationState}
        helperText="Optional — only some places use one."
        maxLength={120}
      />

      <SuggestionInput
        label="Country"
        id="location-country"
        value={draft.locationCountry}
        suggestions={COUNTRIES}
        onChange={(value) => update({ locationCountry: value }, 'debounced')}
        error={errors.locationCountry}
        placeholder="e.g. India, United Kingdom"
        required
        maxLength={80}
      />

      <div className="rounded-xl border border-dark-700 bg-dark-900/60 p-4">
        <p className="text-sm font-medium text-dark-200">Use my current area</p>
        <p className="mt-1 text-xs leading-relaxed text-dark-500">
          Optional. Your exact position is never stored: coordinates are rounded to two decimal
          places, and distance is always shown as a range, never an exact figure.
        </p>
        <button
          type="button"
          onClick={useCurrentArea}
          disabled={locating}
          className="mt-3 inline-flex items-center gap-2 rounded-xl border border-primary-500/50 px-4 py-2 text-sm font-medium text-primary-400 transition hover:bg-primary-600/15 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-400"
        >
          <LocateFixed className="h-4 w-4" aria-hidden="true" />
          {locating ? 'Locating…' : geoApplied ? 'Update my current area' : 'Use my current area'}
        </button>
        {geoApplied && <p className="mt-2 text-xs text-emerald-400">Current area set.</p>}
        {geoError && (
          <p className="mt-2 text-xs text-red-400" role="alert">
            {geoError}
          </p>
        )}
      </div>

      <SaveStatus saving={saving} savedAt={savedAt} />
    </div>
  )
}

function SaveStatus({ saving, savedAt }: { saving: boolean; savedAt: number | null }) {
  if (saving) return <p className="text-xs text-dark-500" aria-live="polite">Saving…</p>
  if (savedAt !== null) return <p className="text-xs text-emerald-400" aria-live="polite">Saved</p>
  return <p className="text-xs text-dark-600" aria-live="polite">Your changes save as you go.</p>
}