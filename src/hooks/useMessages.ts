import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/authContext'
import type { Message } from '../types'
import type { Database } from '../types/database'

type MessageRow = Database['public']['Tables']['messages']['Row']

interface UseMessagesOptions {
  pageSize?: number
}

interface UseMessagesReturn {
  messages: Message[]
  loading: boolean
  error: string | null
  hasMore: boolean
  loadMore: () => Promise<void>
  sendMessage: (content: string) => Promise<{ error: string | null }>
  reload: () => Promise<void>
}

/**
 * Loads messages for a match with pagination, realtime subscription,
 * optimistic send with retry, and unsent draft per match.
 */
export function useMessages(
  matchId: string | undefined,
  options: UseMessagesOptions = {}
): UseMessagesReturn {
  const { pageSize = 30 } = options
  const { user } = useAuth()

  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)

  const channelRef = useRef<RealtimeChannel | null>(null)
  const draftRef = useRef<string>('')

  // Load initial messages
  const loadMessages = useCallback(
    async (reset = false) => {
      if (!matchId || !user) return

      setLoading(true)
      setError(null)

      try {
        let query = supabase
          .from('messages')
          .select('*')
          .eq('match_id', matchId)
          .order('created_at', { ascending: false })
          .limit(pageSize)

        if (!reset && messages.length > 0) {
          const oldest = messages[0]
          if (oldest) {
            query = query.lt('created_at', oldest.created_at)
          }
        }

        const { data, error: fetchError } = await query

        if (fetchError) throw fetchError

        const rows = (data ?? []) as MessageRow[]
        const newMessages = rows.map<Message>((row) => ({
          id: row.id,
          match_id: row.match_id,
          sender_id: row.sender_id,
          content: row.content,
          message_type: row.message_type,
          read_at: row.read_at,
          created_at: row.created_at,
        }))

        if (reset) {
          setMessages(newMessages.reverse())
          setHasMore(rows.length === pageSize)
        } else {
          setMessages((prev) => [...newMessages.reverse(), ...prev])
          setHasMore(rows.length === pageSize)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load messages')
      } finally {
        setLoading(false)
      }
    },
    [matchId, user, pageSize, messages]
  )

  // Load more (pagination up)
  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return
    await loadMessages(false)
  }, [loading, hasMore, loadMessages])

  // Reload (reset)
  const reload = useCallback(async () => {
    await loadMessages(true)
  }, [loadMessages])

  // Send message with optimistic update and retry
  const sendMessage = useCallback(
    async (content: string): Promise<{ error: string | null }> => {
      if (!matchId || !user || !content.trim()) {
        return { error: 'Cannot send empty message' }
      }

      // Optimistic message
      const optimisticId = `temp-${Date.now()}`
      const optimisticMessage: Message = {
        id: optimisticId,
        match_id: matchId,
        sender_id: user.id,
        content: content.trim(),
        message_type: 'text',
        read_at: null,
        created_at: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, optimisticMessage])

      try {
        const { data, error: insertError } = await supabase
          .from('messages')
          .insert({
            match_id: matchId,
            sender_id: user.id,
            content: content.trim(),
            message_type: 'text',
          })
          .select()
          .single()

        if (insertError) throw insertError

        if (data) {
          const row = data as MessageRow
          const realMessage: Message = {
            id: row.id,
            match_id: row.match_id,
            sender_id: row.sender_id,
            content: row.content,
            message_type: row.message_type,
            read_at: row.read_at,
            created_at: row.created_at,
          }

          // Replace optimistic with real
          setMessages((prev) =>
            prev.map((m) => (m.id === optimisticId ? realMessage : m))
          )
        }

        return { error: null }
      } catch (err) {
        // Remove optimistic message on failure
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
        const message = err instanceof Error ? err.message : 'Failed to send'

        // Save to draft for retry
        draftRef.current = content

        return { error: message }
      }
    },
    [matchId, user]
  )

  // Subscribe to realtime
  useEffect(() => {
    if (!matchId) return

    // Load initial messages
    void loadMessages(true)

    // Subscribe to realtime changes for this match only
    const channel = supabase
      .channel(`messages:${matchId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          const row = payload.new as MessageRow
          const message: Message = {
            id: row.id,
            match_id: row.match_id,
            sender_id: row.sender_id,
            content: row.content,
            message_type: row.message_type,
            read_at: row.read_at,
            created_at: row.created_at,
          }

          // Only add if not already present (avoid duplicates from optimistic)
          setMessages((prev) => {
            if (prev.some((m) => m.id === message.id)) return prev
            return [...prev, message]
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          const row = payload.new as MessageRow
          const updated: Message = {
            id: row.id,
            match_id: row.match_id,
            sender_id: row.sender_id,
            content: row.content,
            message_type: row.message_type,
            read_at: row.read_at,
            created_at: row.created_at,
          }

          setMessages((prev) =>
            prev.map((m) => (m.id === updated.id ? updated : m))
          )
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [matchId, loadMessages])

  return {
    messages,
    loading,
    error,
    hasMore,
    loadMore,
    sendMessage,
    reload,
  }
}

/** Sends a message. RLS rejects it if the sender is not part of the match. */
export async function sendMessage(matchId: string, content: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You need to be signed in to send a message.' }

  const { error } = await supabase.from('messages').insert({
    match_id: matchId,
    sender_id: user.id,
    content,
    message_type: 'text',
  })

  return { error: error ? error.message : null }
}

/**
 * Marks every received, still-unread message of a match as read. Called when a
 * thread is opened so the unread badge drains.
 */
export async function markMessagesRead(matchId: string) {
  const { error } = await supabase.rpc('mark_messages_read', { p_match_id: matchId })
  return { error: error ? error.message : null }
}
