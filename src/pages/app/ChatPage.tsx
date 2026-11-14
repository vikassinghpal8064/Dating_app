import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../lib/authContext'
import { useMatches } from '../../hooks/useMatches'
import { useMessages, markMessagesRead } from '../../hooks/useMessages'
import { usePresence } from '../../hooks/usePresence'
import { MessageBubble } from '../../components/chat/MessageBubble'
import { ChatInput } from '../../components/chat/ChatInput'
import { ChatHeader } from '../../components/chat/ChatHeader'
import { SafetyBanner } from '../../components/chat/SafetyBanner'
import { ScamWarning } from '../../components/safety/ScamWarning'
import { flagSuspiciousMessage } from '../../lib/safety'
import { Button, InlineMessage, PageContainer, QueryState } from '../../components/ui'
import { unmatchMember } from '../../hooks/useMatches'
import type { Message } from '../../types'

export function ChatPage() {
  const { matchId } = useParams<{ matchId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const matches = useMatches()
  const {
    messages,
    loading,
    error: messagesError,
    hasMore,
    loadMore,
    sendMessage,
  } = useMessages(matchId)

  const { isPartnerOnline, isPartnerTyping, setTyping } = usePresence(matchId)

  const [sendError, setSendError] = useState('')
  const [loadingMore, setLoadingMore] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevLengthRef = useRef(0)

  const match = (matches.data ?? []).find((entry) => entry.id === matchId)
  const person = match?.matched_user

  // Mark messages as read when thread opens or new messages arrive
  useEffect(() => {
    if (!matchId || loading) return
    const hasUnreadIncoming = messages.some(
      (message) => message.sender_id !== user?.id && !message.read_at
    )
    if (!hasUnreadIncoming) return
    void markMessagesRead(matchId)
  }, [matchId, loading, messages, user?.id])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > prevLengthRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
    prevLengthRef.current = messages.length
  }, [messages.length])

  const handleSend = async (content: string) => {
    if (!matchId) return
    setSendError('')

    const { error } = await sendMessage(content)
    if (error) {
      setSendError(error)
    }
  }

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    await loadMore()
    setLoadingMore(false)
  }

  const handleUnmatch = async () => {
    if (!matchId || !confirm('Are you sure you want to unmatch? This will delete the conversation for both of you.')) {
      return
    }
    const { error } = await unmatchMember(matchId)
    if (error) {
      alert(error)
    } else {
      navigate('/app/messages')
    }
  }

  const handleReport = () => {
    alert('Report feature coming soon')
  }

  const handleBlock = async () => {
    if (!matchId || !person) return
    if (!confirm(`Block ${person.full_name}? You will no longer see each other.`)) {
      return
    }
    // Block logic would go here (create block row)
    alert('Block feature coming soon')
  }

  // Loading state
  if (matches.status === 'loading' || loading) {
    return (
      <PageContainer variant="narrow">
        <QueryState status="loading" error={null} onRetry={() => {}} label="conversation" />
      </PageContainer>
    )
  }

  // Error state
  if (matches.status === 'error') {
    return (
      <PageContainer variant="narrow">
        <QueryState
          status="error"
          error={matches.error}
          onRetry={matches.reload}
          label="this conversation"
        />
      </PageContainer>
    )
  }

  // Not found
  if (!match || !person) {
    return (
      <PageContainer variant="narrow">
        <div className="glass-strong rounded-2xl p-10 text-center">
          <h1 className="font-display text-2xl font-bold text-dark-50">Conversation not found</h1>
          <p className="mt-2 text-dark-400">
            This conversation does not exist, or you are not part of it.
          </p>
          <Button className="mt-6" onClick={() => navigate('/app/messages')}>
            Back to messages
          </Button>
        </div>
      </PageContainer>
    )
  }

  // Group messages by day
  const groupedMessages = groupMessagesByDay(messages)

  return (
    <div className="flex h-full flex-col bg-dark-950">
      <ChatHeader
        matchId={matchId!}
        partner={person}
        isPartnerOnline={isPartnerOnline}
        onUnmatch={handleUnmatch}
        onReport={handleReport}
        onBlock={handleBlock}
      />

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4"
        aria-live="polite"
        aria-label="Messages"
      >
        {messagesError && (
          <InlineMessage tone="error" className="mb-4">
            {messagesError}
          </InlineMessage>
        )}

        {/* Safety banner for new conversations */}
        {messages.length === 0 && (
          <div className="mb-4">
            <SafetyBanner />
          </div>
        )}

        {/* Load more button */}
        {hasMore && (
          <div className="mb-4 flex justify-center">
            <Button variant="outline" size="sm" onClick={handleLoadMore} loading={loadingMore}>
              Load earlier messages
            </Button>
          </div>
        )}

        {/* Messages grouped by day */}
        {groupedMessages.map(({ date, messages: dayMessages }) => (
          <div key={date}>
            <div className="my-4 flex items-center gap-4">
              <div className="h-px flex-1 bg-dark-700" />
              <span className="text-xs font-medium text-dark-500">{formatDayLabel(date)}</span>
              <div className="h-px flex-1 bg-dark-700" />
            </div>
            <div className="space-y-3">
              {dayMessages.map((message) => {
                const isMine = message.sender_id === user?.id
                const isScam = !isMine && flagSuspiciousMessage(message.content)

                return (
                  <div key={message.id} className="space-y-2">
                    {isScam && <ScamWarning />}
                    <MessageBubble
                      message={message}
                      isMine={isMine}
                      showSeen
                    />
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isPartnerTyping && (
          <div className="mt-3 flex justify-start">
            <div className="rounded-2xl bg-dark-800 px-4 py-2.5">
              <div className="flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-dark-400" style={{ animationDelay: '0ms' }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-dark-400" style={{ animationDelay: '150ms' }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-dark-400" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-dark-500">
            No messages yet. Say hello!
          </p>
        )}
      </div>

      {/* Send error */}
      {sendError && (
        <div className="px-4">
          <InlineMessage tone="error">{sendError}</InlineMessage>
        </div>
      )}

      <ChatInput onSend={handleSend} onTypingChange={setTyping} />
    </div>
  )
}

interface MessageGroup {
  date: string
  messages: Message[]
}

function groupMessagesByDay(messages: Message[]): MessageGroup[] {
  const groups: Map<string, Message[]> = new Map()

  for (const message of messages) {
    const date = new Date(message.created_at).toISOString().split('T')[0]
    if (!groups.has(date)) {
      groups.set(date, [])
    }
    groups.get(date)!.push(message)
  }

  return Array.from(groups.entries()).map(([date, messages]) => ({ date, messages }))
}

function formatDayLabel(isoDate: string): string {
  const date = new Date(isoDate)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === today.toDateString()) {
    return 'Today'
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday'
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
  }
}
