import { useRef, useState, useEffect } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { Send, Smile } from 'lucide-react'
import { Button } from '../ui'

interface ChatInputProps {
  onSend: (content: string) => void
  disabled?: boolean
  onTypingChange?: (typing: boolean) => void
}

// Tiny built-in emoji list (no external library)
const EMOJI_LIST = ['😀', '😂', '❤️', '👍', '🔥', '🎉', '😍', '🤔', '😢', '👋']

export function ChatInput({ onSend, disabled, onTypingChange }: ChatInputProps) {
  const [content, setContent] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Autosize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`
  }, [content])

  const handleChange = (value: string) => {
    setContent(value)

    // Notify typing
    if (onTypingChange) {
      onTypingChange(true)

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }

      typingTimeoutRef.current = setTimeout(() => {
        onTypingChange(false)
      }, 2000)
    }
  }

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault()
    if (!content.trim() || disabled) return

    onSend(content.trim())
    setContent('')

    // Stop typing indicator
    if (onTypingChange) {
      onTypingChange(false)
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter to send, Shift+Enter for newline
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const insertEmoji = (emoji: string) => {
    setContent((prev) => prev + emoji)
    setShowEmoji(false)
    textareaRef.current?.focus()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 border-t border-dark-700 p-4">
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          disabled={disabled}
          maxLength={2000}
          rows={1}
          className="w-full resize-none rounded-xl border border-dark-700 bg-dark-900 px-4 py-3 pr-12 text-sm text-dark-50 placeholder-dark-500 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50"
          aria-label="Message input"
        />

        {/* Emoji button */}
        <button
          type="button"
          onClick={() => setShowEmoji(!showEmoji)}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-dark-400 transition-colors hover:bg-dark-800 hover:text-dark-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          aria-label="Add emoji"
        >
          <Smile className="h-5 w-5" />
        </button>

        {/* Emoji picker */}
        {showEmoji && (
          <div className="absolute bottom-full right-0 mb-2 rounded-xl border border-dark-700 bg-dark-900 p-3 shadow-xl">
            <div className="grid grid-cols-5 gap-2">
              {EMOJI_LIST.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => insertEmoji(emoji)}
                  className="rounded-lg p-2 text-2xl transition-colors hover:bg-dark-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  aria-label={`Insert ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-dark-500">
          {content.length > 0 && `${content.length}/2000`}
        </p>
        <Button type="submit" size="sm" disabled={disabled || !content.trim()}>
          <Send className="h-4 w-4" aria-hidden="true" />
          Send
        </Button>
      </div>
    </form>
  )
}
