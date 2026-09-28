import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart,
  Compass,
  Flag,
  Image as ImageIcon,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { PageContainer, PageHeader, Tabs } from '../../components/ui'
import type { TabItem } from '../../components/ui'
import { useAuth } from '../../lib/authContext'

/*
 * The moderation console renders no live data yet.
 *
 * The tables a moderator needs all exist now — `reports`, `profile_photos`,
 * `user_roles`, `blocks` — and the access control is real and is what this page
 * is here to prove. What is missing is this page's own read-and-write path
 * into them: the server grants a moderator verdict-writing and role-reading
 * surface, but no SECURITY DEFINER function that returns a queue, and no
 * cross-member profile read, so the browser cannot yet be handed a list of
 * other people's rows to render.
 *
 * Rather than render a dashboard of invented numbers, each section states what
 * it would need. Where the database already does the work, that is said plainly
 * rather than claimed as missing, because the distinction matters: a ban is
 * enforced in the schema today, and this page is the part that is not built.
 */

const adminTabs: TabItem[] = [
  { value: 'access', label: 'Your access', icon: <ShieldCheck className="h-4 w-4" /> },
  { value: 'reports', label: 'Reports', icon: <Flag className="h-4 w-4" /> },
  { value: 'photos', label: 'Photo moderation', icon: <ImageIcon className="h-4 w-4" /> },
  { value: 'users', label: 'Users', icon: <Users className="h-4 w-4" /> },
  { value: 'stats', label: 'Statistics', icon: <BarChart className="h-4 w-4" /> },
]

interface SectionSpec {
  heading: string
  body: string
  needs: string
}

const SECTIONS: Record<Exclude<TabItem['value'], 'access'>, SectionSpec> = {
  reports: {
    heading: 'No reports queue',
    body: 'The reports table exists, with a reason and a status, and a member is allowed to file one. Nothing reads it back: there is no function that returns a moderator’s queue, so there is nothing to triage, respond to, or escalate from here.',
    needs: 'Needs a security-definer function returning the open reports for a moderator, so the browser is handed a queue rather than every member’s rows.',
  },
  photos: {
    heading: 'No photo queue',
    body: 'Refusals are enforced. A moderator can record a verdict on a photo and it is withdrawn from that member’s profile immediately, on every later edit, and from the published feed — and a member cannot delete or overturn a verdict against their own photo. What is missing is the queue: a way to see which images are pending, and any record of who made a call.',
    needs: 'Needs a security-definer function listing pending verdicts, a private storage bucket with signed-URL access for reviewers, and a moderator action log.',
  },
  users: {
    heading: 'No user management',
    body: 'Roles are real and server-held: an admin and a moderator role exist, is_admin() and is_moderator() answer for the caller, and a member can neither grant themselves a role nor write the is_admin column. What an administrator still cannot do from a browser is read another member’s row, so nothing can be listed, suspended, verified or deleted from here.',
    needs: 'Needs a security-definer admin action per operation, each audited server-side, since the browser is never given another member’s row.',
  },
  stats: {
    heading: 'No statistics',
    body: 'Every aggregate this page would show requires reading across all profiles, which row-level security forbids for the current session — by design, since that is the same rule that stops a member reading anyone else. The numbers would also be meaningless at this size.',
    needs: 'Needs a security-definer function returning aggregates, so the browser receives a count and never another member’s row.',
  },
}

export function AdminPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<string>('access')

  const panelId = `panel-${activeTab}`

  return (
    <PageContainer>
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader title="Admin" subtitle="Moderation and administration." />
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-red-500/15 px-3 py-1 text-sm font-medium text-red-300">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Administrator
        </span>
      </div>

      <Tabs
        tabs={adminTabs}
        value={activeTab}
        onChange={setActiveTab}
        variant="underline"
        label="Admin sections"
        className="mb-6"
      />

      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        tabIndex={0}
        className="focus-visible:outline-none"
      >
        {activeTab === 'access' ? (
          <section className="glass rounded-2xl p-6">
            <h2 className="font-display text-xl font-semibold text-dark-50">
              You are signed in as an administrator
            </h2>
            <p className="mt-2 leading-relaxed text-dark-300">
              This flag came from the <code className="text-primary-300">is_admin</code> column on
              your profile row. It was not inferred in the browser from an email address, and it
              cannot be set by you — the browser only ever writes the profile fields the edit form
              exposes.
            </p>

            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-dark-700 bg-dark-900/60 p-4">
                <dt className="text-sm text-dark-400">Account</dt>
                <dd className="mt-1 text-dark-100">{user?.full_name}</dd>
              </div>
              <div className="rounded-xl border border-dark-700 bg-dark-900/60 p-4">
                <dt className="text-sm text-dark-400">Email</dt>
                <dd className="break-all text-dark-100">{user?.email}</dd>
              </div>
            </dl>

            <div className="mt-6 rounded-xl border border-primary-500/25 bg-primary-600/5 p-4">
              <h3 className="font-semibold text-dark-50">What this console cannot do yet</h3>
              <p className="mt-2 text-sm leading-relaxed text-dark-300">
                The four sections to the right are outlined but empty on purpose. Open each one to
                see the specific table it would need. Shipping placeholder panels with invented
                counts would tell you the moderation tooling exists when it does not.
              </p>
            </div>

            <div className="mt-6">
              <Link
                to="/app/discover"
                className="inline-flex items-center gap-2 rounded-xl border border-dark-700 bg-dark-800/60 px-5 py-3 font-medium text-dark-100 transition hover:border-primary-500/50 hover:bg-dark-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-400"
              >
                <Compass className="h-4 w-4" aria-hidden="true" />
                Back to the app
              </Link>
            </div>
          </section>
        ) : (
          activeTab in SECTIONS && <SectionPanel section={SECTIONS[activeTab as keyof typeof SECTIONS]} />
        )}
      </div>
    </PageContainer>
  )
}

function SectionPanel({ section }: { section: SectionSpec }) {
  return (
    <section className="glass rounded-2xl p-6">
      <h2 className="font-display text-xl font-semibold text-dark-50">{section.heading}</h2>
      <p className="mt-2 leading-relaxed text-dark-300">{section.body}</p>
      <p className="mt-4 rounded-xl border border-dark-700 bg-dark-900/60 p-4 text-sm leading-relaxed text-dark-400">
        {section.needs}
      </p>
    </section>
  )
}
