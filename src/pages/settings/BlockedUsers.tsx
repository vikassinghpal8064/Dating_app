import { useEffect, useState } from 'react'
import { Ban, UserX } from 'lucide-react'
import {
  Avatar,
  Button,
  EmptyState,
  PageContainer,
  PageHeader,
  InlineMessage,
} from '../../components/ui'
import { getBlockedUsers, unblockUser } from '../../lib/safety'

interface BlockedUser {
  id: string
  full_name: string
  photos: string[]
}

export function BlockedUsersPage() {
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadBlockedUsers = async () => {
    setLoading(true)
    setError(null)
    const users = await getBlockedUsers()
    setBlockedUsers(users)
    setLoading(false)
  }

  useEffect(() => {
    void loadBlockedUsers()
  }, [])

  const handleUnblock = async (userId: string) => {
    const { error: unblockError } = await unblockUser(userId)
    if (unblockError) {
      setError(unblockError)
      return
    }
    setBlockedUsers((prev) => prev.filter((u) => u.id !== userId))
  }

  return (
    <PageContainer variant="narrow">
      <PageHeader
        title="Blocked users"
        subtitle="People you've blocked won't see you in discovery or search. You can unblock them at any time."
      />

      {error && <InlineMessage tone="error" className="mb-4">{error}</InlineMessage>}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 rounded-2xl border border-dark-700 bg-dark-900/60 p-4">
              <div className="h-14 w-14 animate-pulse rounded-full bg-dark-800" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 animate-pulse rounded bg-dark-800" />
                <div className="h-3 w-24 animate-pulse rounded bg-dark-800" />
              </div>
            </div>
          ))}
        </div>
      ) : blockedUsers.length === 0 ? (
        <EmptyState
          icon={<UserX className="h-10 w-10 text-dark-500" aria-hidden="true" />}
          title="No blocked users"
          description="When you block someone, they'll appear here."
        />
      ) : (
        <ul className="space-y-3">
          {blockedUsers.map((user) => (
            <li key={user.id}>
              <div className="flex items-center gap-4 rounded-2xl border border-dark-700 bg-dark-900/60 p-4">
                <Avatar
                  src={user.photos[0] ?? null}
                  fallback={user.full_name}
                  alt={`${user.full_name}'s profile photo`}
                  size="lg"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-dark-50">{user.full_name}</p>
                  <p className="flex items-center gap-1.5 text-sm text-dark-400">
                    <Ban className="h-3.5 w-3.5" />
                    Blocked
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleUnblock(user.id)}>
                  Unblock
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  )
}
