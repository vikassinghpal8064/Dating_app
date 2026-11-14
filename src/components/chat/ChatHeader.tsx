import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, MoreVertical, Eye, HeartOff, AlertTriangle, Ban } from 'lucide-react'
import { Avatar } from '../ui'
import { WhatsAppButton } from '../contact/WhatsAppButton'
import type { PublicProfile } from '../../types'

interface ChatHeaderProps {
  matchId: string
  partner: PublicProfile
  isPartnerOnline: boolean
  onUnmatch: () => void
  onReport: () => void
  onBlock: () => void
}

export function ChatHeader({
  partner,
  isPartnerOnline,
  onUnmatch,
  onReport,
  onBlock,
}: ChatHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="flex items-center justify-between border-b border-dark-700 bg-dark-900/80 px-4 py-3 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <Link
          to="/app/messages"
          className="rounded-lg p-2 text-dark-400 transition-colors hover:bg-dark-800 hover:text-dark-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          aria-label="Back to messages"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        <Link to={`/app/profile/${partner.id}`} className="flex items-center gap-3">
          <Avatar
            src={partner.photos[0] ?? null}
            fallback={partner.full_name}
            alt={`${partner.full_name}'s profile photo`}
            size="md"
            status={isPartnerOnline ? 'online' : 'offline'}
          />
          <div>
            <h1 className="font-display text-lg font-semibold text-dark-50">
              {partner.full_name}
            </h1>
            <p className="text-xs text-dark-400">
              {isPartnerOnline ? 'Online now' : 'Offline'}
            </p>
          </div>
        </Link>
      </div>

      <div className="flex items-center gap-2">
        {/* WhatsApp button (consent-gated) */}
        <WhatsAppButton targetUserId={partner.id} name={partner.full_name} />

        {/* Menu */}
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
                <Link
                  to={`/app/profile/${partner.id}`}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-dark-100 transition-colors hover:bg-dark-800"
                >
                  <Eye className="h-4 w-4" />
                  View profile
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    onUnmatch()
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-dark-100 transition-colors hover:bg-dark-800"
                >
                  <HeartOff className="h-4 w-4" />
                  Unmatch
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    onReport()
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-dark-100 transition-colors hover:bg-dark-800"
                >
                  <AlertTriangle className="h-4 w-4" />
                  Report
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    onBlock()
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
      </div>
    </header>
  )
}
