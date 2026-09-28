import { Link } from 'react-router-dom'
import { Compass, Heart, Search } from 'lucide-react'
import { PageContainer, PageHeader } from '../../components/ui'

/**
 * Likes are not implemented.
 *
 * A like has to be persisted so the sender and the receiver can each see a
 * different list. The database this build talks to has no `likes` table, so
 * there is nothing to read from and nothing honest to render. Inventing counts
 * or a "no likes yet" list would be a lie dressed as a feature, so this page
 * says what is missing and routes to the screens that do work.
 */
export function LikesPage() {
  return (
    <PageContainer variant="narrow">
      <PageHeader
        title="Likes"
        subtitle="Who likes you, and who you have liked."
      />

      <div className="glass rounded-2xl p-6 sm:p-8">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-600/15">
            <Heart className="h-6 w-6 text-primary-400" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-display text-xl font-semibold text-dark-50">
              Likes are not switched on in this build
            </h2>
            <p className="text-sm text-dark-400">Two lists: liked you, and you liked.</p>
          </div>
        </div>

        <p className="mt-6 leading-relaxed text-dark-300">
          Sending a like writes a row so the other person can be told, and so you can see
          who liked you back. That <code className="text-primary-300">likes</code> table is not
          part of the database yet, so this page cannot read either list. Rather than show
          counts that do not mean anything, we are telling you plainly.
        </p>

        <p className="mt-4 leading-relaxed text-dark-300">
          Everything around it works. Browse the people who match your preferences, or search
          with filters, and open anyone you like the look of.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            to="/app/discover"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 px-5 py-3 font-medium text-white transition hover:from-primary-500 hover:to-primary-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-400"
          >
            <Compass className="h-4 w-4" aria-hidden="true" />
            Browse Discover
          </Link>
          <Link
            to="/app/search"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-dark-700 bg-dark-800/60 px-5 py-3 font-medium text-dark-100 transition hover:border-primary-500/50 hover:bg-dark-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-400"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            Search with filters
          </Link>
        </div>

        <p className="mt-6 text-xs leading-relaxed text-dark-500">
          When likes ship, this page will list everyone who liked you and everyone you liked,
          and both lists will be removed the moment you are unblocked.
        </p>
      </div>
    </PageContainer>
  )
}
