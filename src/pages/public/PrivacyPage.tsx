import { Section, PageContainer, PageHeader } from '../../components/ui'
import {
  AlertTriangle,
  Clock,
  Database,
  Globe,
  Info,
  Lock,
  Shield,
  Trash2,
} from 'lucide-react'

/*
 * Every line below is checkable against the schema in `src/types/database.ts`
 * and the code that reads it. Where a right is not implemented in software, it
 * is handled by email and said so, rather than promised as a button.
 */

const privacySections = [
  {
    icon: Shield,
    title: 'What the database holds',
    items: [
      'profiles — email, full name, date of birth, gender, who you are interested in, bio, photos, city, country, coordinates, and your privacy flags',
      'matches — who is matched with whom, when the match was made, and when the thread last had activity',
      'messages — the text of each message, its sender, and its timestamp',
      'user_preferences — your age range, maximum distance, who can find you, notification switches and privacy switches',
      'private_contacts — your phone number, held apart from everything else and reachable only through an approved request',
      'profile_photos — the photos you have chosen to publish, and any image a moderator has refused',
      'whatsapp_consents — a request for your phone number, its status, and your response',
      'likes, passes, matches, messages, blocks and reports — who you liked or passed on, who you matched with, what was said, and anything you reported',
    ],
  },
  {
    icon: Lock,
    title: 'What other members can see',
    items: [
      'They read the public_profiles view, not the profiles table. The view has no email column, no date of birth and no coordinates in it',
      'Your name, age, gender, bio, photos, who you are interested in, city and country',
      'Distance, and only as a band such as “10 to 25 km away” — never a number precise enough to locate you',
      'Your online status and last active time, and only if you have left those switches on',
      'Nothing else. Row-level security rejects the rest of the read at the database, so it is not a matter of the interface choosing not to ask',
    ],
  },
  {
    icon: Lock,
    title: 'Where your phone number lives',
    items: [
      'It is not a column on profiles. It is not in the public_profiles view. There is no code path that selects it',
      'A matched person can ask for it. The request is stored as a status, not as a number',
      'The number is only released after you approve that specific request, and you can revoke it afterwards',
      'Until you approve, nobody can read it — not the other person, not an administrator, not this application',
    ],
  },
  {
    icon: Database,
    title: 'What we do with it',
    items: [
      'Run the service: show you candidates, hold your matches, deliver your messages',
      'Enforce your own switches — who can discover you, which distances you are shown, whether your online status is public',
      'Enforce the 18+ floor, which is checked both in the form and by a database constraint on your date of birth',
      'That is the whole list. There is no analytics script, no advertising identifier and no third-party tracking in this application',
    ],
  },
  {
    icon: Globe,
    title: 'Who else is involved',
    items: [
      'Supabase — Postgres, authentication and file storage. Your rows sit inside their infrastructure',
      'Your email provider, for the verification and password reset messages',
      'Nobody else. Your data is not sold, and it is not shared with advertisers, because there is no advertising and no analytics',
    ],
  },
  {
    icon: Clock,
    title: 'How long it is kept',
    items: [
      'For as long as your account exists',
      'Deleting your account is not built as a button in this release. Email us and we action the request, together with the deletions it implies',
      'Backups are a Supabase concern and are rotated on their own schedule; we do not add to them',
    ],
  },
]

const notImplemented = [
  'Download a copy of your data from inside the app — not built. Email us and we will send it.',
  'Delete your account from inside the app — not built. Email us and we will action it.',
  'Export in a portable machine format — not built. Email us.',
  'Pause or hide your profile entirely — the closest thing today is “Only my matches” under who can discover me.',
]

export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-dark-950">
      <Section padding="xl">
        <PageContainer variant="narrow">
          <PageHeader
            title="Privacy Policy"
            subtitle="What is stored, who can read it, and what this build cannot do yet."
          />

          <div className="glass-strong rounded-2xl p-6 mb-12 border border-primary-500/20 bg-primary-600/5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary-600/20 flex items-center justify-center flex-shrink-0">
                <Info className="w-6 h-6 text-primary-400" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold text-dark-50 mb-2">
                  About this document
                </h3>
                <p className="text-dark-400 text-sm">
                  Everything below describes the software exactly as it is built today — the
                  tables that hold your data and the row-level security that limits who can read
                  them. Where something is not implemented, it says so instead of linking to a
                  button that does nothing. This has not been through legal review, so check it
                  against the rules that apply where you operate before you open registrations.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            {privacySections.map((section, index) => (
              <div
                key={section.title}
                className="glass rounded-2xl p-6 animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-primary-600/10 flex items-center justify-center flex-shrink-0">
                    <section.icon className="w-6 h-6 text-primary-400" aria-hidden="true" />
                  </div>
                  <h2 className="font-display text-xl font-semibold text-dark-50 mt-1">
                    {section.title}
                  </h2>
                </div>
                <ul className="space-y-3">
                  {section.items.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-dark-300">
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-primary-500 flex-shrink-0 mt-2"
                        aria-hidden="true"
                      />
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="glass rounded-2xl p-6 border border-dark-700 mt-12">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-dark-50 mb-4">
              <AlertTriangle className="h-5 w-5 text-primary-400" aria-hidden="true" />
              Rights you have, handled by email
            </h2>
            <ul className="space-y-3">
              {notImplemented.map((item) => (
                <li key={item} className="flex items-start gap-3 text-dark-300">
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-primary-500 flex-shrink-0 mt-2"
                    aria-hidden="true"
                  />
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="glass rounded-2xl p-6 border border-dark-700 mt-6">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-dark-50 mb-4">
              <Trash2 className="h-5 w-5 text-primary-400" aria-hidden="true" />
              Contact
            </h2>
            <p className="text-dark-400">
              Anything about your data, including the requests above, goes to{' '}
              <a
                href="mailto:privacy@heartconnect.app"
                className="text-primary-400 hover:underline underline-offset-2"
              >
                privacy@heartconnect.app
              </a>
              . We action access and deletion requests within 30 days.
            </p>
          </div>
        </PageContainer>
      </Section>
    </div>
  )
}
