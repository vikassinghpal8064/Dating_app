import { Section, PageContainer, PageHeader, Button } from '../../components/ui'
import { Link } from 'react-router-dom'
import { Heart, Ruler, Shield, Users } from 'lucide-react'

/*
 * No invented team, no invented founding date, no invented user numbers.
 *
 * Everything claimed below is either enforced in the code or visible in the
 * database: row-level security on every table, 18+ only, phone numbers behind a
 * consent check, coordinates rounded and never published, distances shown as
 * bands, and a hard cap on how far discovery will look.
 */

const principles = [
  {
    icon: Shield,
    title: 'Row-level security, not app-level hiding',
    description:
      'Every table denies by default. A member can only read the rows that belong to them, and messages are readable by the two people in the thread. That is enforced in the database, not in this interface.',
  },
  {
    icon: Ruler,
    title: '18+, in two places',
    description:
      'The sign-up form refuses a date of birth that puts you under 18, and the database has its own check on the same column. The client-side check is a courtesy, not the control.',
  },
  {
    icon: Users,
    title: 'Phone numbers are not profile data',
    description:
      'Your number is stored apart from your profile and is only ever released to someone you have matched with, and only after you approve their request. No other member can read it, ever.',
  },
  {
    icon: Heart,
    title: 'Distance is a band, not a pin',
    description:
      'Coordinates are rounded to two decimal places before they are stored, and they are never sent to another member. What people see is a band such as “10 to 25 km away”.',
  },
]

const limits = [
  'Liking and swiping are not built. There is no likes table in the database, so no like is recorded and no like list exists.',
  'There is no reporting or moderation console. The admin area is gated by a real role check, but the tools behind it are not built.',
  'There are no premium features and no billing. Everything that exists is currently free.',
  'Photos are https URLs you supply yourself. There is no upload widget, and no file is ever uploaded to us.',
  'There is no video, no voice note, and no read receipt beyond a stored timestamp.',
]

export function AboutPage() {
  return (
    <div className="min-h-screen bg-dark-950">
      <Section padding="xl">
        <PageContainer variant="narrow">
          <PageHeader
            title="About HeartConnect"
            subtitle="A dating service built around a small set of promises we can actually keep."
          />

          <div className="prose prose-invert max-w-none space-y-8 text-dark-400">
            <p className="text-lg leading-relaxed">
              Most dating apps treat your privacy as a settings screen. We treat it as the
              default. The most important decisions in this codebase are the ones about what
              another member is allowed to read, and they are made in the database rather than
              in the interface.
            </p>
            <p className="leading-relaxed">
              That means a short list of promises you can check, and a short list of things that
              are not built yet. Both are on this page.
            </p>
          </div>
        </PageContainer>
      </Section>

      <Section padding="xl">
        <PageContainer>
          <div className="mb-12 text-center">
            <h2 className="mb-4 font-display text-3xl font-bold text-dark-50 sm:text-4xl">
              What we actually enforce
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-dark-400">
              Each of these is a constraint in the schema or the client, not a promise in a
              marketing deck.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {principles.map((principle, index) => (
              <div
                key={principle.title}
                className="glass animate-fade-in rounded-2xl p-6 transition-all duration-300 hover:border-dark-600"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="mb-4 flex w-12 h-12 items-center justify-center rounded-xl bg-primary-600/10">
                  <principle.icon className="h-6 w-6 text-primary-400" aria-hidden="true" />
                </div>
                <h3 className="mb-2 font-display text-xl font-semibold text-dark-50">
                  {principle.title}
                </h3>
                <p className="leading-relaxed text-dark-400">{principle.description}</p>
              </div>
            ))}
          </div>
        </PageContainer>
      </Section>

      <Section padding="xl">
        <PageContainer variant="narrow">
          <div className="mb-12 text-center">
            <h2 className="mb-4 font-display text-3xl font-bold text-dark-50 sm:text-4xl">
              What is not built yet
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-dark-400">
              Published here so nobody has to discover it by clicking a button that does nothing.
            </p>
          </div>

          <ul className="space-y-3">
            {limits.map((limit) => (
              <li
                key={limit}
                className="flex items-start gap-3 rounded-2xl border border-dark-700 bg-dark-900/60 p-4 leading-relaxed text-dark-300"
              >
                <span
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500"
                  aria-hidden="true"
                />
                <span>{limit}</span>
              </li>
            ))}
          </ul>
        </PageContainer>
      </Section>

      <Section padding="xl">
        <PageContainer variant="narrow">
          <div className="glass-strong rounded-2xl p-8 text-center lg:p-12">
            <h2 className="mb-4 font-display text-3xl font-bold text-dark-50 sm:text-4xl">
              Read the details yourself
            </h2>
            <p className="mx-auto mb-8 max-w-2xl text-lg text-dark-400">
              The privacy policy lists every table that holds your data. The safety centre explains
              what this service can and cannot protect you from. Both are written to be read
              before you sign up, not after.
            </p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/auth/signup" className="inline-flex items-center gap-2">
                <Button size="lg" className="gap-2">
                  <Heart className="w-5 h-5" aria-hidden="true" />
                  Create your profile
                </Button>
              </Link>
              <Link to="/privacy">
                <Button size="lg" variant="outline">
                  Read the privacy policy
                </Button>
              </Link>
            </div>
          </div>
        </PageContainer>
      </Section>
    </div>
  )
}
