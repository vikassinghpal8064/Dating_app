import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Lock, Send } from 'lucide-react'
import {
  Avatar,
  Button,
  InlineMessage,
  Label,
  PageContainer,
  QueryState,
  Textarea,
} from '../../components/ui'
import { useAuth } from '../../lib/authContext'
import { sendMessage, useMatches, useMessages } from '../../hooks/useMatches'
import { messageSchema } from '../../utils/validation'
import { formatRelativeTime } from '../../utils'

export function ChatPage() {
  const { matchId } = useParams<{ matchId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const matches = useMatches()
  const thread = useMessages(matchId)

  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const match = (matches.data ?? []).find((entry) => entry.id === matchId)
  const person = match?.matched_user
  const messages = thread.data ?? []

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  async function handleSend(event: FormEvent) {
    event.preventDefault()
    setError('')

    const parsed = messageSchema.safeParse({ content: draft })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'That message cannot be sent.')
      return
    }

    if (!matchId) return

    setSending(true)
    const { error: sendError } = await sendMessage(matchId, parsed.data.content.trim())
    setSending(false)

    if (sendError) {
      setError(sendError)
      return
    }

    setDraft('')
    thread.reload()
  }

  /* The conversation header needs the match, the thread needs the match id.
     Waiting for both avoids flashing "Unknown person" on a slow network. */
  if (matches.status === 'loading' || thread.status === 'loading' || matches.status === 'idle') {
    return (
      <PageContainer variant="narrow">
        <QueryState status="loading" error={null} onRetry={() => {}} label="conversation" />
      </PageContainer>
    )
  }

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

  return (
    <PageContainer variant="narrow">
      <Link
        to="/app/messages"
        className="mb-4 inline-flex items-center gap-2 rounded-lg text-sm text-dark-400 transition-colors hover:text-dark-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        All messages
      </Link>

      <div className="glass-strong overflow-hidden rounded-2xl">
        <header className="flex items-center gap-3 border-b border-dark-700 p-4">
          <Avatar
            src={person.photos[0] ?? null}
            fallback={person.full_name}
            alt={`${person.full_name}’s profile photo`}
            status={person.is_online ? 'online' : 'offline'}
          />
          <div className="min-w-0">
            <h1 className="truncate font-display text-lg font-semibold text-dark-50">
              {person.full_name}
            </h1>
            <p className="text-xs text-dark-400">
              {person.is_online
                ? 'Online now'
                : `Active ${formatRelativeTime(person.last_active)}`}
            </p>
          </div>
        </header>

        <div
          className="max-h-[60vh] space-y-3 overflow-y-auto p-4"
          aria-live="polite"
          aria-label="Messages"
        >
          {messages.length === 0 ? (
            <p className="py-10 text-center text-sm text-dark-500">
              No messages yet. Say hello.
            </p>
          ) : (
            messages.map((message) => {
              const isMine = message.sender_id === user?.id

              return (
                <div
                  key={message.id}
                  className={isMine ? 'flex justify-end' : 'flex justify-start'}
                >
                  <div
                    className={[
                      'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                      isMine
                        ? 'bg-primary-600 text-white'
                        : 'bg-dark-800 text-dark-100',
                    ].join(' ')}
                  >
                    {/* User text is rendered as a text node, never as HTML. */}
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                    <p
                      className={
                        isMine
                          ? 'mt-1 text-right text-[11px] text-primary-100/70'
                          : 'mt-1 text-[11px] text-dark-500'
                      }
                    >
                      {formatRelativeTime(message.created_at)}
                    </p>
                  </div>
                </div>
              )
            })
          )}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleSend} className="space-y-3 border-t border-dark-700 p-4" noValidate>
          {error && <InlineMessage tone="error">{error}</InlineMessage>}

          <Label htmlFor="message" className="sr-only">
            Write a message
          </Label>
          <Textarea
            id="message"
            name="content"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Message ${person.full_name}…`}
            rows={2}
            maxLength={2000}
            required
          />

          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 text-xs text-dark-500">
              <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Only you and {person.full_name} can read this
            </p>
            <Button type="submit" size="sm" loading={sending}>
              {!sending && <Send className="h-4 w-4" aria-hidden="true" />}
              Send
            </Button>
          </div>
        </form>
      </div>
    </PageContainer>
  )
}
