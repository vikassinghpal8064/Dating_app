import { AlertTriangle } from 'lucide-react'
import type { SupabaseEnvKey } from '../lib/supabaseConfig'

/**
 * Rendered instead of the app when required environment variables are absent,
 * so a misconfigured deployment fails loudly and legibly rather than showing a
 * blank page.
 */
export function ConfigErrorScreen({ missingKeys }: { missingKeys: readonly SupabaseEnvKey[] }) {
  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <div
          role="alert"
          className="glass-strong rounded-2xl border border-red-500/30 bg-red-500/5 p-6 sm:p-8"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-500/15 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-red-400" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-bold text-dark-50 mb-2">
                Configuration required
              </h1>
              <p className="text-dark-300">
                HeartConnect cannot start because required environment variables are
                missing. This is a setup error, not a bug in the app.
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-xl bg-dark-950/70 border border-dark-700 p-4">
            <p className="text-sm font-medium text-dark-200 mb-2">Missing variables</p>
            <ul className="space-y-1">
              {missingKeys.map((key) => (
                <li key={key} className="font-mono text-sm text-red-300">
                  {key}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 rounded-xl bg-dark-950/70 border border-dark-700 p-4">
            <p className="text-sm font-medium text-dark-200 mb-3">How to fix it</p>
            <ol className="space-y-2 text-sm text-dark-300 list-decimal list-inside">
              <li>
                Run <code className="font-mono text-primary-300">cp .env.example .env</code>
              </li>
              <li>
                Fill in the values from your Supabase project settings
                <span className="text-dark-500"> (Project Settings &rarr; API)</span>
              </li>
              <li>Restart the dev server</li>
            </ol>
          </div>

          <p className="mt-6 text-sm text-dark-400 border-t border-dark-800 pt-4">
            <strong className="text-dark-200">Security note:</strong> use the{' '}
            <code className="font-mono text-primary-300">anon</code> key only. Never place the{' '}
            <code className="font-mono text-red-300">service_role</code> key in a{' '}
            <code className="font-mono">VITE_*</code> variable &mdash; every{' '}
            <code className="font-mono">VITE_*</code> value is inlined into the public
            browser bundle and would bypass Row Level Security.
          </p>
        </div>
      </div>
    </div>
  )
}
