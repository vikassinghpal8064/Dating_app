import { useCallback, useEffect, useState } from 'react'
import { MessageSquare, RefreshCw, Search } from 'lucide-react'
import {
  Button,
  EmptyState,
  InlineMessage,
  Input,
  Modal,
  PageSpinner,
} from '../../components/ui'
import { supabase } from '../../lib/supabase'
import { formatCount, formatDateTime, initials } from '../../utils/adminFormat'

interface Conversation {
  match_id: string
  user_a_id: string
  user_a_name: string
  user_b_id: string
  user_b_name: string
  matched_at: string
  last_message_at: string | null
  message_count: number
  unread_count: number
  last_message_preview: string | null
  last_sender_name: string | null
}

interface ConversationMessage {
  id: string
  sender_id: string
  sender_name: string
  content: string
  message_type: string
  read_at: string | null
  created_at: string
}

interface ConversationDetail {
  match: {
    id: string
    matched_at: string
    last_message_at: string | null
    message_count: number
    participants: { id: string; full_name: string; email: string | null }[]
  }
  messages: ConversationMessage[]
}

interface MessageSearchRow {
  message_id: string
  match_id: string
  sender_id: string
  sender_name: string
  recipient_name: string
  content: string
  message_type: string
  read_at: string | null
  created_at: string
}

function isConversationDetail(value: unknown): value is ConversationDetail {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.match === 'object' && Array.isArray(candidate.messages)
}

function Person({ name }: { name: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-600/20 text-xs font-semibold text-primary-300"
        aria-hidden="true"
      >
        {initials(name)}
      </span>
      <span className="truncate text-sm font-medium text-dark-100">{name}</span>
    </span>
  )
}

export function MessagesTab() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [openMatch, setOpenMatch] = useState<string | null>(null)
  const [detail, setDetail] = useState<ConversationDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [results, setResults] = useState<MessageSearchRow[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const loadConversations = useCallback(async (search: string) => {
    setLoading(true)
    const { data, error: rpcError } = await supabase.rpc('admin_list_conversations', {
      p_query: search.trim() || null,
      p_limit: 100,
      p_offset: 0,
    })
    if (rpcError) {
      setError(rpcError.message)
      setConversations([])
    } else {
      setError(null)
      setConversations((data ?? []) as Conversation[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadConversations(query)
    }, 300)
    return () => clearTimeout(timer)
  }, [query, loadConversations])

  const openConversation = useCallback(async (matchId: string) => {
    setOpenMatch(matchId)
    setDetail(null)
    setDetailError(null)
    setDetailLoading(true)
    const { data, error: rpcError } = await supabase.rpc('admin_get_conversation', {
      p_match: matchId,
      p_limit: 200,
    })
    if (rpcError) {
      setDetailError(rpcError.message)
    } else if (!isConversationDetail(data)) {
      setDetailError('The conversation payload was not in the expected shape.')
    } else {
      setDetail(data)
    }
    setDetailLoading(false)
  }, [])

  const runSearch = async () => {
    if (!searchTerm.trim()) {
      setResults(null)
      setSearchError(null)
      return
    }
    setSearching(true)
    const { data, error: rpcError } = await supabase.rpc('admin_search_messages', {
      p_query: searchTerm.trim(),
      p_limit: 100,
    })
    if (rpcError) {
      setSearchError(rpcError.message)
      setResults(null)
    } else {
      setSearchError(null)
      setResults((data ?? []) as MessageSearchRow[])
    }
    setSearching(false)
  }

  return (
    <section className="space-y-6" aria-labelledby="messages-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="messages-heading" className="font-display text-xl font-semibold text-dark-50">
            Conversations
          </h2>
          <p className="mt-1 text-sm text-dark-500">
            Every match and every message body. Opening a conversation is recorded in the audit
            log.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => loadConversations(query)} loading={loading}>
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          Refresh
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-500" />
        <Input
          type="search"
          placeholder="Filter by participant name or message text…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="pl-10"
          aria-label="Filter conversations"
        />
      </div>

      {error ? (
        <InlineMessage tone="error">{error}</InlineMessage>
      ) : loading ? (
        <PageSpinner />
      ) : conversations.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="h-10 w-10 text-primary-500" aria-hidden="true" />}
          title="No conversations yet"
          description="A conversation appears here as soon as two members match."
        />
      ) : (
        <ul className="divide-y divide-dark-800 overflow-hidden rounded-2xl border border-dark-700 bg-dark-900/60">
          {conversations.map((conversation) => (
            <li key={conversation.match_id}>
              <button
                type="button"
                onClick={() => void openConversation(conversation.match_id)}
                className="flex w-full flex-col gap-2 px-4 py-3 text-left transition-colors hover:bg-dark-800/60 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary-500 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="flex min-w-0 flex-1 items-center gap-3">
                  <Person name={conversation.user_a_name} />
                  <span className="text-dark-500" aria-hidden="true">
                    +
                  </span>
                  <Person name={conversation.user_b_name} />
                </span>
                <span className="flex shrink-0 items-center gap-3 text-xs text-dark-500">
                  <span>{formatCount(conversation.message_count)} messages</span>
                  {conversation.unread_count > 0 && (
                    <span className="rounded-full bg-primary-600/20 px-2 py-0.5 text-primary-300">
                      {formatCount(conversation.unread_count)} unread
                    </span>
                  )}
                  <time dateTime={conversation.last_message_at ?? conversation.matched_at}>
                    {formatDateTime(conversation.last_message_at ?? conversation.matched_at)}
                  </time>
                </span>
                {conversation.last_message_preview && (
                  <span className="w-full truncate text-sm text-dark-400 sm:hidden">
                    {conversation.last_sender_name}: {conversation.last_message_preview}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-2xl border border-dark-700 bg-dark-900/60 p-5">
        <h3 className="font-display text-lg font-semibold text-dark-50">Search every message</h3>
        <p className="mt-1 text-sm text-dark-500">
          Searches message bodies across all conversations. Searches are audited too.
        </p>
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault()
            void runSearch()
          }}
        >
          <Input
            type="search"
            placeholder="Search message text…"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            aria-label="Search message text"
            className="flex-1"
          />
          <Button type="submit" loading={searching}>
            Search
          </Button>
        </form>

        {searchError && (
          <div className="mt-3">
            <InlineMessage tone="error">{searchError}</InlineMessage>
          </div>
        )}

        {results !== null && (
          <div className="mt-4">
            {results.length === 0 ? (
              <p className="text-sm text-dark-500">No messages matched that search.</p>
            ) : (
              <ul className="space-y-2">
                {results.map((result) => (
                  <li key={result.message_id}>
                    <button
                      type="button"
                      onClick={() => void openConversation(result.match_id)}
                      className="w-full rounded-xl border border-dark-800 bg-dark-950/40 p-3 text-left transition-colors hover:border-dark-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
                    >
                      <span className="flex items-center justify-between gap-2 text-xs text-dark-500">
                        <span className="font-medium text-dark-300">
                          {result.sender_name} → {result.recipient_name}
                        </span>
                        <time dateTime={result.created_at}>{formatDateTime(result.created_at)}</time>
                      </span>
                      <span className="mt-1 block truncate text-sm text-dark-200">
                        {result.content}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {openMatch && (
        <Modal isOpen onClose={() => setOpenMatch(null)} title="Conversation" size="xl">
          {detailLoading ? (
            <PageSpinner />
          ) : detailError ? (
            <InlineMessage tone="error">{detailError}</InlineMessage>
          ) : detail ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  {detail.match.participants.map((participant, index) => (
                    <span key={participant.id} className="flex items-center gap-2">
                      {index > 0 && (
                        <span className="text-dark-500" aria-hidden="true">
                          +
                        </span>
                      )}
                      <Person name={participant.full_name} />
                    </span>
                  ))}
                </div>
                <p className="text-xs text-dark-500">
                  Matched {formatDateTime(detail.match.matched_at)} ·{' '}
                  {formatCount(detail.match.message_count)} messages
                </p>
              </div>

              <InlineMessage tone="info">
                Message bodies are visible to administrators. This view has been written to the
                audit log.
              </InlineMessage>

              {detail.messages.length === 0 ? (
                <p className="py-8 text-center text-sm text-dark-500">
                  These members matched but have not exchanged messages yet.
                </p>
              ) : (
                <ul className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
                  {detail.messages.map((message) => (
                    <li
                      key={message.id}
                      className="rounded-xl border border-dark-800 bg-dark-950/40 p-3"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs text-dark-500">
                        <span className="font-medium text-dark-300">{message.sender_name}</span>
                        <time dateTime={message.created_at}>{formatDateTime(message.created_at)}</time>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-dark-100">
                        {message.content}
                      </p>
                      <p className="mt-1 text-xs text-dark-500">
                        {message.message_type} · {message.read_at ? 'read' : 'unread'}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </Modal>
      )}
    </section>
  )
}

export default MessagesTab
