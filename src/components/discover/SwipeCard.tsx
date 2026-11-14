import { useEffect, useRef, useState } from 'react'
import { motion, useAnimationControls, useMotionValue, useTransform } from 'framer-motion'
import type { PanInfo } from 'framer-motion'
import { ChevronLeft, ChevronRight, MapPin, MoreHorizontal } from 'lucide-react'
import { Avatar, Badge, Chip } from '../ui'
import { bucketLabel, LOOKING_FOR_LABELS } from '../../utils/search'
import type { DeckDirection } from '../../hooks/useDeck'
import type { SearchProfile } from '../../types'

export interface SwipeCardProps {
  profile: SearchProfile
  isTop: boolean
  /** When set (and matching this card) the card flies off in that direction. */
  flying: { profileId: string; direction: DeckDirection } | null
  onFlingDone: (profileId: string, direction: DeckDirection) => void
  onDragRelease: (profileId: string, direction: DeckDirection | null) => void
  onOpenMenu: () => void
}

interface FlingTarget {
  x: number
  y: number
  rotate: number
}

function flingTarget(direction: DeckDirection): FlingTarget {
  switch (direction) {
    case 'left':
      return { x: -920, y: 0, rotate: -22 }
    case 'right':
      return { x: 920, y: 0, rotate: 22 }
    case 'up':
      return { x: 0, y: -1100, rotate: 0 }
  }
}

/**
 * The top card of the /discover deck. Drag left (pass), right (like), up
 * (super like) — or read the direction as a button/keyboard tap and the card
 * animates off itself. Photo carousel, verified badge, distance bucket,
 * bio and interests all live on the card; the ⋯ button opens the report/block
 * menu.
 */
export function SwipeCard({
  profile,
  isTop,
  flying,
  onFlingDone,
  onDragRelease,
  onOpenMenu,
}: SwipeCardProps) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rotate = useTransform(x, [-260, 260], [-18, 18])
  const likeOpacity = useTransform(x, [40, 170], [0, 1])
  const passOpacity = useTransform(x, [-170, -40], [1, 0])
  const superOpacity = useTransform(y, [-190, -90], [1, 0])
  const controls = useAnimationControls()

  const [photoIndex, setPhotoIndex] = useState(0)
  const photos = profile.photos
  const isFlying = flying?.profileId === profile.id

  // Fire onFlingDone exactly once per flight, when the off-screen tween lands.
  const flingReported = useRef(false)
  useEffect(() => {
    flingReported.current = false
  }, [flying])

  // Enter / return-to-origin / fly-off, driven by the `flying` prop. A fling
  // that the server rejects (daily limit, etc.) springs the card straight back.
  useEffect(() => {
    if (isFlying && flying) {
      const target = flingTarget(flying.direction)
      void controls.start({
        x: target.x,
        y: target.y,
        rotate: target.rotate,
        opacity: 0,
        transition: { duration: 0.28, ease: 'easeIn' },
      })
    } else {
      void controls.start({
        x: 0,
        y: 0,
        rotate: 0,
        opacity: 1,
        scale: 1,
        transition: { type: 'spring', stiffness: 340, damping: 26 },
      })
    }
  }, [controls, flying, isFlying])

  const handleAnimationComplete = () => {
    if (isFlying && !flingReported.current) {
      flingReported.current = true
      onFlingDone(profile.id, flying?.direction ?? 'right')
    }
  }

  const handleDragEnd = (_event: unknown, info: PanInfo) => {
    const velocity = info.velocity
    const offset = info.offset
    const dy = offset.y
    const dx = offset.x
    const upward = (velocity.y < -360 || dy < -140) && Math.abs(dy) > Math.abs(dx) + 30
    if (upward) {
      onDragRelease(profile.id, 'up')
      return
    }
    if (velocity.x > 320 || dx > 130) {
      onDragRelease(profile.id, 'right')
      return
    }
    if (velocity.x < -320 || dx < -130) {
      onDragRelease(profile.id, 'left')
      return
    }
    // Below threshold: spring back to origin.
    void controls.start({
      x: 0,
      y: 0,
      rotate: 0,
      opacity: 1,
      transition: { type: 'spring', stiffness: 340, damping: 26 },
    })
    onDragRelease(profile.id, null)
  }

  const mainPhoto = Array.isArray(photos) ? photos[photoIndex] ?? photos[0] : undefined
  const lookingFor = LOOKING_FOR_LABELS[profile.looking_for] ?? profile.looking_for
  const interests = profile.interests.slice(0, 4)

  return (
    <motion.div
      className="absolute inset-0 overflow-hidden rounded-3xl border border-dark-700 bg-dark-900 shadow-glow-xl"
      style={{ x, y, rotate }}
      initial={{ opacity: 0.15, scale: 0.96 }}
      animate={controls}
      drag={isFlying || !isTop ? false : true}
      dragElastic={0.7}
      dragMomentum={false}
      onDragEnd={(_, info) => handleDragEnd(_, info)}
      onAnimationComplete={handleAnimationComplete}
      data-testid="swipe-card"
    >
      <div className="flex h-full flex-col">
        {/* Photo pane */}
        <div className="relative min-h-0 flex-1">
          {mainPhoto ? (
            <img
              src={mainPhoto}
              alt={`${profile.full_name}'s photo`}
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
              width={400}
              height={600}
              draggable={false}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary-600 to-primary-800">
              <Avatar fallback={profile.full_name} size="2xl" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/30" />

          {/* Pass / Like / Super-like hint badges (opacity follows the drag) */}
          <motion.span
            className="absolute left-5 top-6 rounded-lg border-2 border-red-400 bg-black/50 px-3 py-1 font-display text-lg font-bold tracking-widest text-red-400 backdrop-blur-sm"
            style={{ opacity: passOpacity }}
            aria-hidden="true"
          >
            PASS
          </motion.span>
          <motion.span
            className="absolute right-5 top-6 rounded-lg border-2 border-accent-emerald bg-black/50 px-3 py-1 font-display text-lg font-bold tracking-widest text-accent-emerald backdrop-blur-sm"
            style={{ opacity: likeOpacity }}
            aria-hidden="true"
          >
            LIKE
          </motion.span>
          <motion.span
            className="absolute left-1/2 top-1/3 -translate-x-1/2 rounded-lg border-2 border-accent-gold bg-black/50 px-3 py-1 font-display text-lg font-bold tracking-widest text-accent-gold backdrop-blur-sm"
            style={{ opacity: superOpacity }}
            aria-hidden="true"
          >
            SUPER LIKE
          </motion.span>

          {/* Menu + online badges */}
          <div className="absolute right-4 top-4 flex items-center gap-2">
            {profile.is_online && (
              <Badge variant="online" size="sm">
                Online
              </Badge>
            )}
            <button
              type="button"
              onClick={onOpenMenu}
              aria-label={`More options for ${profile.full_name}`}
              className="rounded-full bg-black/50 p-2 text-dark-100 backdrop-blur-sm transition-colors hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          {/* Photo carousel controls */}
          {(photos.length ?? 0) > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous photo"
                onClick={(event) => {
                  event.stopPropagation()
                  setPhotoIndex((index) => (index - 1 + photos.length) % photos.length)
                }}
                className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-dark-100 backdrop-blur-sm transition-colors hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Next photo"
                onClick={(event) => {
                  event.stopPropagation()
                  setPhotoIndex((index) => (index + 1) % photos.length)
                }}
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-dark-100 backdrop-blur-sm transition-colors hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </>
          )}

          {/* Dots */}
          {(photos.length ?? 0) > 1 && (
            <div className="absolute inset-x-0 top-3 flex justify-center gap-1.5" aria-hidden="true">
              {photos.map((_, index) => (
                <span
                  key={index}
                  className={`h-1.5 rounded-full transition-all ${
                    index === photoIndex ? 'w-4 bg-primary-400' : 'w-1.5 bg-white/50'
                  }`}
                />
              ))}
            </div>
          )}

          {/* Name + distance on the photo */}
          <div className="absolute inset-x-0 bottom-0 p-4">
            <h2 className="flex flex-wrap items-center gap-2 font-display text-2xl font-semibold text-white">
              <span>
                {profile.full_name}, {profile.age}
              </span>
              {profile.is_verified && (
                <Badge variant="verified" size="sm" title="Verified member">
                  Verified
                </Badge>
              )}
            </h2>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-dark-200">
              <MapPin className="h-4 w-4 text-primary-400" aria-hidden="true" />
              {bucketLabel(profile.distance_bucket)}
            </p>
            <Chip variant="filled" size="sm" className="mt-2">
              Looking for: {lookingFor}
            </Chip>
          </div>
        </div>

        {/* Body: bio + interests */}
        <div className="border-t border-dark-800 bg-dark-900 px-5 py-4">
          {profile.bio ? (
            <p className="text-sm leading-relaxed text-dark-200 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
              {profile.bio}
            </p>
          ) : (
            <p className="text-sm text-dark-500">No bio yet.</p>
          )}
          {interests.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="Interests">
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
      </div>
    </motion.div>
  )
}

/** The stacked card(s) behind the top card — static, only for depth. */
export function DeckBackCard({ profile, depth }: { profile: SearchProfile; depth: number }) {
  const scale = 1 - depth * 0.045
  const lift = depth * 10
  const rotate = depth % 2 === 0 ? -(depth + 1.5) : depth + 1.5

  return (
    <div
      aria-hidden="true"
      data-testid="deck-back-card"
      className="absolute inset-0 rounded-3xl border border-dark-700 bg-dark-800/80"
      style={{ transform: `scale(${scale}) translateY(${lift}px) rotate(${rotate}deg)` }}
    >
      <div className="flex h-full items-end p-4">
        <p className="font-display text-lg font-semibold text-dark-300">
          {profile.full_name}, {profile.age}
        </p>
      </div>
    </div>
  )
}