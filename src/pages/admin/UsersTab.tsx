import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Search } from 'lucide-react'
import {
  Badge,
  Button,
  EmptyState,
  InlineMessage,
  Input,
  PageSpinner,
} from '../../components/ui'
import { supabase } from '../../lib/supabase'
import { formatCount, formatDateTime } from '../../utils/adminFormat'
import { UserDetailModal } from './UserDetailModal'

const PAGE_SIZE = 50

interface AdminUser {
  id: string
  full_name: string | null
  email: string | null
  age: number | null
  gender: string
  location_city: string | null
  location_country: string | null
  is_verified: boolean
  is_banned: boolean
  is_admin: boolean
  incognito: boolean
  profile_paused: boolean
  is_visible: boolean
  created_at: string
  last_active_at: string | null
  photos_count: number
  approved_uploads: number
  matches_count: number
  messages_sent: number
  likes_sent: number
  reports_against: number
  verification_status: string | null
}

export function UsersTab() {
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  const load = useCallback(async (search: string, offset: number) => {
    const firstPage = offset === 0
    if (firstPage) setLoading(true)
    else setLoadingMore(true)

    const { data, error: rpcError } = await supabase.rpc('admin_list_users', {
      p_query: search.trim() || null,
      p_limit: PAGE_SIZE,
      p_offset: offset,
    })

    if (rpcError) {
      setError(rpcError.message)
      if (firstPage) setUsers([])
    } else {
      const rows = (data ?? []) as AdminUser[]
      setError(null)
      setUsers((previous) => (firstPage ? rows : [...previous, ...rows]))
    }

    if (firstPage) setLoading(false)
    else setLoadingMore(false)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      void load(query, 0)
    }, 300)
    return () => clearTimeout(timer)
  }, [query, load])

  return (
    <section className="space-y-4" aria-labelledby="users-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="users-heading" className="font-display text-xl font-semibold text-dark-50">
            Members
          </h2>
          <p className="mt-1 text-sm text-dark-500">
            {formatCount(users.length)} loaded. Search by name, email or city, then open a member
            for the full record.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => load(query, 0)} loading={loading}>
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          Refresh
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-500" />
        <Input
          type="search"
          placeholder="Search by name, email or city…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="pl-10"
          aria-label="Search members"
        />
      </div>

      {error ? (
        <InlineMessage tone="error">{error}</InlineMessage>
      ) : loading ? (
        <PageSpinner />
      ) : users.length === 0 ? (
        <EmptyState
          icon={<Search className="h-10 w-10 text-primary-500" aria-hidden="true" />}
          title="No members found"
          description={
            query.trim()
              ? 'Nobody matches that search. Try a different name, email or city.'
              : 'The member list is empty.'
          }
        />
      ) : (
        <>
          <ul className="space-y-3">
            {users.map((user) => (
              <li
                key={user.id}
                className="rounded-2xl border border-dark-700 bg-dark-900/60 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-dark-50">
                        {user.full_name ?? 'Unnamed member'}
                        {user.age !== null && (
                          <span className="font-normal text-dark-400">, {user.age}</span>
                        )}
                      </p>
                      {user.is_admin && <Badge variant="premium">Admin</Badge>}
                      {user.is_verified && <Badge variant="verified">Verified</Badge>}
                      {user.is_banned && (
                        <Badge className="border-red-500/30 bg-red-500/20 text-red-300">
                          Banned
                        </Badge>
                      )}
                      {user.incognito && <Badge variant="warning">Incognito</Badge>}
                      {user.profile_paused && <Badge variant="warning">Paused</Badge>}
                      {user.verification_status === 'pending' && (
                        <Badge variant="new">Verification pending</Badge>
                      )}
                    </div>
                    <p className="truncate text-sm text-dark-400">{user.email ?? 'No email'}</p>
                    <p className="mt-1 text-xs text-dark-500">
                      {[user.location_city, user.location_country].filter(Boolean).join(', ') ||
                        'No location'}{' '}
                      · Joined {formatDateTime(user.created_at)} · Last active{' '}
                      {formatDateTime(user.last_active_at)}
                    </p>
                    <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-dark-400">
                      <span>{formatCount(user.matches_count)} matches</span>
                      <span>{formatCount(user.messages_sent)} messages sent</span>
                      <span>{formatCount(user.likes_sent)} likes sent</span>
                      <span>{formatCount(user.photos_count + user.approved_uploads)} photos</span>
                      {user.reports_against > 0 && (
                        <span className="text-red-300">
                          {formatCount(user.reports_against)} reports against
                        </span>
                      )}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedUserId(user.id)}
                  >
                    Open
                  </Button>
                </div>
              </li>
            ))}
          </ul>

          {users.length % PAGE_SIZE === 0 && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => load(query, users.length)}
                loading={loadingMore}
              >
                Load more members
              </Button>
            </div>
          )}
        </>
      )}

      {selectedUserId && (
        <UserDetailModal
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
          onChanged={() => load(query, 0)}
        />
      )}
    </section>
  )
}

export default UsersTab
