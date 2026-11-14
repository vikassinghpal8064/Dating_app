import { motion } from 'framer-motion'
import { Heart } from 'lucide-react'
import { Button, Modal } from '../ui'
import type { SearchProfile } from '../../types'

interface MatchModalProps {
  open: boolean
  profile: SearchProfile | null
  onSendMessage: () => void
  onKeepSwiping: () => void
}

/**
 * "It's a match!" celebration. Shown only after `send_like` reports a mutual
 * pair — it never guesses from the client side.
 */
export function MatchModal({ open, profile, onSendMessage, onKeepSwiping }: MatchModalProps) {
  const name = profile?.full_name ?? 'your match'

  return (
    <Modal
      isOpen={open}
      onClose={onKeepSwiping}
      size="sm"
      showCloseButton={false}
    >
      <div className="text-center">
        <motion.div
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 16 }}
          className="relative mx-auto mb-5 flex h-20 w-20 items-center justify-center"
          aria-hidden="true"
        >
          <motion.span
            animate={{ scale: [1, 1.35, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-0 rounded-full bg-primary-600/30"
          />
          <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary-600 shadow-glow">
            <Heart className="h-8 w-8 text-white" fill="currentColor" />
          </span>
        </motion.div>

        <h2
          id="match-modal-title"
          className="font-display text-3xl font-bold text-dark-50"
        >
          It&rsquo;s a match!
        </h2>
        <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-dark-300">
          You and {name} liked each other. Say hello and start the conversation.
        </p>

        <div className="mt-7 space-y-3">
          <Button variant="primary" className="w-full" onClick={onSendMessage}>
            Send a message
          </Button>
          <Button variant="ghost" className="w-full" onClick={onKeepSwiping}>
            Keep swiping
          </Button>
        </div>
      </div>
    </Modal>
  )
}