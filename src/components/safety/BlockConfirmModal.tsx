import { useState } from 'react'
import { Ban } from 'lucide-react'
import { Modal, Button, InlineMessage } from '../ui'
import { blockUser } from '../../lib/safety'

interface BlockConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  blockedUserId: string
  blockedUserName: string
  onBlock?: () => void
}

export function BlockConfirmModal({
  isOpen,
  onClose,
  blockedUserId,
  blockedUserName,
  onBlock,
}: BlockConfirmModalProps) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleBlock = async () => {
    setSubmitting(true)
    setError(null)

    const { error: blockError } = await blockUser(blockedUserId)

    if (blockError) {
      setError(blockError)
      setSubmitting(false)
      return
    }

    if (onBlock) {
      onBlock()
    }

    setSubmitting(false)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Block user">
      <div className="space-y-5">
        <div className="rounded-xl border border-danger-500/30 bg-danger-500/10 p-4">
          <div className="flex items-start gap-3">
            <Ban className="mt-0.5 h-5 w-5 shrink-0 text-danger-400" />
            <div className="text-sm text-danger-100">
              <p className="font-medium">Block {blockedUserName}?</p>
              <ul className="mt-2 space-y-1 text-danger-200/80">
                <li>• You will no longer see each other in discovery or search</li>
                <li>• Your existing chat will be hidden for both of you</li>
                <li>• They will not be notified that you blocked them</li>
                <li>• You can unblock them later from Settings</li>
              </ul>
            </div>
          </div>
        </div>

        {error && <InlineMessage tone="error">{error}</InlineMessage>}

        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <button
            onClick={handleBlock}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:opacity-50"
          >
            {submitting ? 'Blocking...' : 'Block'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
