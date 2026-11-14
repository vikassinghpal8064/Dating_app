import { useState } from 'react'
import { MoreVertical, Flag, Ban } from 'lucide-react'
import { ReportModal } from './ReportModal'
import { BlockConfirmModal } from './BlockConfirmModal'

interface ReportBlockMenuProps {
  userId: string
  userName: string
  /** Called after a successful block action */
  onBlock?: () => void
  /** Called after report+block combination */
  onReportAndBlock?: () => void
}

export function ReportBlockMenu({
  userId,
  userName,
  onBlock,
  onReportAndBlock,
}: ReportBlockMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [blockOpen, setBlockOpen] = useState(false)

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className="rounded-lg p-2 text-dark-400 transition-colors hover:bg-dark-800 hover:text-dark-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          aria-label="More options"
          aria-expanded={menuOpen}
        >
          <MoreVertical className="h-5 w-5" />
        </button>

        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setMenuOpen(false)}
              aria-hidden="true"
            />
            <div className="absolute right-0 top-full z-20 mt-2 w-48 rounded-xl border border-dark-700 bg-dark-900 py-1 shadow-xl">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  setReportOpen(true)
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-dark-100 transition-colors hover:bg-dark-800"
              >
                <Flag className="h-4 w-4" />
                Report
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  setBlockOpen(true)
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-danger-400 transition-colors hover:bg-dark-800"
              >
                <Ban className="h-4 w-4" />
                Block
              </button>
            </div>
          </>
        )}
      </div>

      <ReportModal
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        reportedUserId={userId}
        reportedUserName={userName}
        onReportAndBlock={onReportAndBlock}
      />

      <BlockConfirmModal
        isOpen={blockOpen}
        onClose={() => setBlockOpen(false)}
        blockedUserId={userId}
        blockedUserName={userName}
        onBlock={onBlock}
      />
    </>
  )
}
