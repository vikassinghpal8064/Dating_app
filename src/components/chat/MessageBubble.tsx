import type { Message } from '../../types'

interface MessageBubbleProps {
  message: Message
  isMine: boolean
  showSeen?: boolean
}

export function MessageBubble({ message, isMine, showSeen }: MessageBubbleProps) {
  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={[
          'max-w-[75%] rounded-2xl px-4 py-2.5',
          isMine
            ? 'bg-gradient-to-br from-primary-600 to-primary-700 text-white'
            : 'bg-dark-800 text-dark-100',
        ].join(' ')}
      >
        {/* Render as plain text, never HTML. Links stay as plain text. */}
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
          {message.content}
        </p>
        <div className="mt-1 flex items-center justify-end gap-1.5">
          <span
            className={
              isMine ? 'text-[11px] text-primary-100/70' : 'text-[11px] text-dark-500'
            }
          >
            {formatTime(message.created_at)}
          </span>
          {isMine && showSeen && message.read_at && (
            <span className="text-[11px] text-primary-100/70">Seen</span>
          )}
        </div>
      </div>
    </div>
  )
}

function formatTime(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
