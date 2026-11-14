import { Link } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { Avatar, Badge, Chip } from '../ui'
import { bucketLabel, LOOKING_FOR_LABELS } from '../../utils/search'
import type { SearchProfile } from '../../types'

interface SearchResultCardProps {
  profile: SearchProfile
}

const MAX_INTEREST_CHIPS = 3

/**
 * One /search result: photo, name/age, verified badge, a coarse distance
 * bucket, the "looking for" intent and up to three interest chips. The whole
 * card links to the member's public profile.
 */
export function SearchResultCard({ profile }: SearchResultCardProps) {
  const mainPhoto = profile.photos[0]
  const interests = profile.interests.slice(0, MAX_INTEREST_CHIPS)
  const lookingFor = profile.looking_for
  const lookingForLabel = LOOKING_FOR_LABELS[lookingFor] ?? lookingFor

  return (
    <Link
      to={`/app/profile/${profile.id}`}
      className="group block h-full overflow-hidden rounded-2xl border border-dark-700 bg-dark-900/60 transition-colors hover:border-primary-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
    >
      <div className="relative aspect-[4/5] overflow-hidden">
        {mainPhoto ? (
          <img
            src={mainPhoto}
            alt={`${profile.full_name}'s photo`}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary-600 to-primary-800">
            <Avatar fallback={profile.full_name} size="2xl" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

        {profile.is_online && (
          <Badge variant="online" size="sm" className="absolute top-3 right-3">
            Online
          </Badge>
        )}

        {profile.distance_bucket && (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs text-dark-100 backdrop-blur">
            <MapPin className="h-3.5 w-3.5 text-primary-400" aria-hidden="true" />
            {bucketLabel(profile.distance_bucket)}
          </span>
        )}

        <div className="absolute bottom-3 left-0 right-0 px-4">
          <h3 className="flex items-center gap-2 font-display text-xl font-semibold text-white">
            <span className="truncate">
              {profile.full_name}, {profile.age}
            </span>
            {profile.is_verified && (
              <Badge variant="verified" size="sm" title="Verified member">
                Verified
              </Badge>
            )}
          </h3>
          <p className="mt-0.5 truncate text-sm text-dark-200">
            {profile.location_city}
            {profile.location_country ? `, ${profile.location_country}` : ''}
          </p>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <Chip variant="filled" size="sm">
          Looking for: {lookingForLabel}
        </Chip>

        {interests.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Interests">
            {interests.map((interest) => (
              <li key={interest}>
                <Chip variant="outline" size="sm">
                  {interest}
                </Chip>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Link>
  )
}