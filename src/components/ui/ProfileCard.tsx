import { Heart, MessageSquare, MapPin, Star, X } from 'lucide-react'
import { formatDistance } from '../../utils'
import { Avatar } from './Avatar'
import { Badge } from './Badge'
import { Button } from './Button'
import { Card } from './Card'
import { Chip } from './Chip'
import { ProfileCardSkeleton } from './Skeleton'
import type { PublicProfile } from '../../types'

export interface ProfileCardProps {
  profile: PublicProfile
  variant?: 'default' | 'compact' | 'discover' | 'match'
  onLike?: () => void
  onPass?: () => void
  onSuperLike?: () => void
  onMessage?: () => void
  onViewProfile?: () => void
  showActions?: boolean
  isLoading?: boolean
}

const GENDER_LABELS: Record<string, string> = {
  male: 'Man',
  female: 'Woman',
  non_binary: 'Non-binary',
  prefer_not_to_say: 'Prefer not to say',
  everyone: 'Everyone',
}

/** Renders real profile data only — never placeholder copy. */
function interestChips(profile: PublicProfile, limit: number) {
  const interests = profile.interested_in.slice(0, limit)

  if (interests.length === 0) return null

  return (
    <ul className="flex flex-wrap gap-2" aria-label="Interested in">
      {interests.map((interest) => (
        <li key={interest}>
          <Chip variant="outline" size="sm">
            {GENDER_LABELS[interest] ?? interest}
          </Chip>
        </li>
      ))}
    </ul>
  )
}

function PhotoCount({ count }: { count: number }) {
  if (count < 2) return null

  return (
    <p className="text-xs text-dark-500">
      {count} {count === 1 ? 'photo' : 'photos'}
    </p>
  )
}

export function ProfileCard({ 
  profile, 
  variant = 'default', 
  onLike, 
  onPass, 
  onSuperLike, 
  onMessage, 
  onViewProfile,
  showActions = true,
  isLoading = false,
}: ProfileCardProps) {
  if (isLoading) return <ProfileCardSkeleton />

  const distanceText = formatDistance(profile.distance_km ?? null)
  const mainPhoto = profile.photos[0]
  const photoCount = profile.photos.length

  const renderDefault = () => (
    <Card variant="hover" padding="none" className="overflow-hidden h-full flex flex-col" onClick={onViewProfile}>
      <div className="relative aspect-[4/5] overflow-hidden">
        {mainPhoto ? (
          <img 
            src={mainPhoto} 
            alt={`${profile.full_name}'s photo`} 
            className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center">
            <Avatar fallback={profile.full_name} size="2xl" />
          </div>
        )}
        {profile.is_online && (
          <Badge variant="online" size="sm" className="absolute top-3 right-3">
            Online
          </Badge>
        )}
        {profile.distance_km != null && (
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2 py-1 bg-black/60 backdrop-blur rounded-full text-xs text-dark-200">
            <MapPin className="w-3 h-3" aria-hidden="true" />
            <span>{distanceText}</span>
          </div>
        )}
      </div>
      <div className="p-4 space-y-3 flex-1 flex flex-col">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-semibold text-dark-50 truncate">
            {profile.full_name}, {profile.age}
          </h3>
          <p className="text-dark-400 text-sm truncate">{profile.location_city}, {profile.location_country}</p>
        </div>
        <p className="text-dark-300 text-sm line-clamp-2 flex-1">{profile.bio || 'No bio yet'}</p>
        {interestChips(profile, 3)}
        <PhotoCount count={photoCount} />
        {showActions && (
          <div className="flex items-center gap-2 pt-2 border-t border-dark-800">
            <Button variant="outline" size="sm" className="flex-1" onClick={(e) => { e.stopPropagation(); onPass?.() }}>
              <X className="w-4 h-4 mr-1" aria-hidden="true" /> Pass
            </Button>
            <Button variant="primary" size="sm" className="flex-1" onClick={(e) => { e.stopPropagation(); onLike?.() }}>
              <Heart className="w-4 h-4 mr-1" aria-hidden="true" /> Like
            </Button>
          </div>
        )}
      </div>
    </Card>
  )

  const renderCompact = () => (
    <div className="flex items-center gap-3 p-3 glass rounded-xl hover:bg-dark-800/50 transition-colors" onClick={onViewProfile}>
      <Avatar src={mainPhoto} fallback={profile.full_name} size="lg" status={profile.is_online ? 'online' : 'offline'} />
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-dark-50 truncate">{profile.full_name}, {profile.age}</h4>
        <p className="text-dark-400 text-sm truncate">
          {profile.location_city}
          {profile.distance_km != null && ` • ${distanceText}`}
        </p>
      </div>
      {showActions && onMessage && (
        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onMessage() }}>
          <MessageSquare className="w-4 h-4 mr-1" aria-hidden="true" /> Message
        </Button>
      )}
    </div>
  )

  const renderDiscover = () => (
    <div className="relative glass rounded-2xl overflow-hidden touch-none" style={{ width: '100%', maxWidth: '380px' }}>
      <div className="relative aspect-[4/5] overflow-hidden">
        {mainPhoto ? (
          <img 
            src={mainPhoto} 
            alt={`${profile.full_name}'s photo`} 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center">
            <Avatar fallback={profile.full_name} size="2xl" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <h2 className="font-display text-2xl font-bold text-white mb-1">
            {profile.full_name}, {profile.age}
          </h2>
          <p className="text-dark-200 flex items-center gap-1.5">
            <MapPin className="w-4 h-4" aria-hidden="true" />
            {distanceText}
          </p>
        </div>
      </div>
      <div className="p-5 space-y-4">
        <p className="text-dark-300">{profile.bio || 'No bio yet'}</p>
        {interestChips(profile, 4)}
        <PhotoCount count={photoCount} />
        {showActions && (
          <div className="flex items-center gap-3 pt-3 border-t border-dark-800">
            <Button
              variant="ghost"
              size="lg"
              className="flex-1 text-dark-300 hover:text-dark-50"
              onClick={onPass}
              aria-label="Pass on this profile"
            >
              <X className="w-6 h-6" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="flex-1 text-accent-gold hover:text-accent-gold/80"
              onClick={onSuperLike}
              aria-label="Super like this profile"
            >
              <Star className="w-6 h-6" aria-hidden="true" />
            </Button>
            <Button
              variant="primary"
              size="lg"
              className="flex-1"
              onClick={onLike}
              aria-label="Like this profile"
            >
              <Heart className="w-6 h-6" aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )

  const renderMatch = () => (
    <Button
      variant="ghost"
      className="w-full justify-start gap-4 p-3 h-auto"
      onClick={onViewProfile}
    >
      <Avatar
        src={mainPhoto}
        fallback={profile.full_name}
        size="xl"
        status={profile.is_online ? 'online' : 'offline'}
      />
      {/* A <button> may only contain phrasing content, so these are spans. */}
      <span className="flex-1 min-w-0 text-left">
        <span className="flex items-center gap-2">
          <span className="font-display text-lg font-semibold text-dark-50 truncate">
            {profile.full_name}, {profile.age}
          </span>
          {profile.is_online && <Badge variant="online" size="sm">Online</Badge>}
        </span>
        <span className="block text-dark-400 text-sm truncate">
          {profile.location_city}
          {profile.distance_km != null && ` • ${distanceText}`}
        </span>
      </span>
      <MessageSquare className="w-6 h-6 text-dark-500 shrink-0" aria-hidden="true" />
    </Button>
  )

  switch (variant) {
    case 'compact':
      return renderCompact()
    case 'discover':
      return renderDiscover()
    case 'match':
      return renderMatch()
    default:
      return renderDefault()
  }
}