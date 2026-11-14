import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/authContext'

interface UsePresenceReturn {
  isPartnerOnline: boolean
  isPartnerTyping: boolean
  setTyping: (typing: boolean) => void
}

interface PresenceState {
  user_id: string
  typing: boolean
  last_seen: string
}

/**
 * Typing indicator and online status through a Realtime presence channel.
 * Each match has its own presence channel. Members broadcast their typing
 * state and last-seen timestamp.
 */
export function usePresence(matchId: string | undefined): UsePresenceReturn {
  const { user } = useAuth()
  const [isPartnerOnline, setIsPartnerOnline] = useState(false)
  const [isPartnerTyping, setIsPartnerTyping] = useState(false)

  const channelRef = useRef<RealtimeChannel | null>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setTyping = useCallback(
    (typing: boolean) => {
      if (!channelRef.current || !matchId || !user) return

      // Track the channel with our typing state
      channelRef.current.track({
        user_id: user.id,
        typing,
        last_seen: new Date().toISOString(),
        online_at: new Date().toISOString(),
      })

      // Clear any existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }

      // Auto-stop typing after 3 seconds of inactivity
      if (typing) {
        typingTimeoutRef.current = setTimeout(() => {
          if (channelRef.current) {
            channelRef.current.track({
              user_id: user.id,
              typing: false,
              last_seen: new Date().toISOString(),
              online_at: new Date().toISOString(),
            })
          }
        }, 3000)
      }
    },
    [matchId, user]
  )

  useEffect(() => {
    if (!matchId || !user) return

    const channelName = `presence:${matchId}`

    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: user.id,
        },
      },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState() as Record<string, PresenceState[]>
        const presences = Object.values(state).flat()

        // Check if partner is online (any presence with their user_id)
        const partnerPresences = presences.filter((p) => p.user_id !== user.id)
        setIsPartnerOnline(partnerPresences.length > 0)

        // Check if partner is typing
        const partnerTyping = partnerPresences.some((p) => p.typing)
        setIsPartnerTyping(partnerTyping)
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        const presences = newPresences as PresenceState[]
        const partnerPresences = presences.filter((p) => p.user_id !== user.id)
        if (partnerPresences.length > 0) {
          setIsPartnerOnline(true)
          if (partnerPresences.some((p) => p.typing)) {
            setIsPartnerTyping(true)
          }
        }
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        const presences = leftPresences as PresenceState[]
        const partnerPresences = presences.filter((p) => p.user_id !== user.id)
        if (partnerPresences.length > 0) {
          // Re-check remaining presences
          const state = channel.presenceState() as Record<string, PresenceState[]>
          const allPresences = Object.values(state).flat()
          const remainingPartner = allPresences.filter((p) => p.user_id !== user.id)
          setIsPartnerOnline(remainingPartner.length > 0)
          setIsPartnerTyping(remainingPartner.some((p) => p.typing))
        } else {
          setIsPartnerOnline(false)
          setIsPartnerTyping(false)
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Track ourselves as online
          await channel.track({
            user_id: user.id,
            typing: false,
            last_seen: new Date().toISOString(),
            online_at: new Date().toISOString(),
          })
        }
      })

    channelRef.current = channel

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [matchId, user])

  return {
    isPartnerOnline,
    isPartnerTyping,
    setTyping,
  }
}
