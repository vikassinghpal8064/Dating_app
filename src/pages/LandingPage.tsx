import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CheckCircle,
  Heart,
  Lock,
  MapPin,
  MessageSquare,
  Phone,
  Shield,
  Users,
} from 'lucide-react'
import { Button, Card } from '../components/ui'

/**
 * Every claim on this page describes behaviour that is actually implemented.
 * No invented user counts, ratings or "coming soon" features — a marketing page
 * that lies is a bug, not a feature.
 */
const features = [
  {
    icon: Shield,
    title: 'Privacy first',
    description:
      'Your phone number is stored apart from your profile and is only ever released to someone you have matched with, and only if you allow it.',
  },
  {
    icon: MapPin,
    title: 'Distance, not coordinates',
    description:
      'Your position is rounded before it is stored, and other people only ever see a coarse band like "10 to 25 km away" — never a pinpoint.',
  },
  {
    icon: Phone,
    title: 'Consent before WhatsApp',
    description:
      'No one can move you to WhatsApp. A number request has to be approved by both sides, and either person can withdraw at any time.',
  },
  {
    icon: Users,
    title: '18+ and age verified',
    description:
      'The 18+ floor is checked when you sign up and enforced again by the database, so there is no way around it.',
  },
  {
    icon: MessageSquare,
    title: 'Talk only after a match',
    description:
      'Messaging is scoped to matches by row-level security. You cannot message someone who has not matched with you.',
  },
  {
    icon: Lock,
    title: 'The rules are in the database',
    description:
      'Every privacy promise on this page is a schema constraint, not a toggle in a settings screen. A bug in the browser cannot leak a row it is not allowed to read.',
  },
]

const principles = [
  {
    title: 'We do not sell your data',
    body: 'No ad tracking, no data broker resale, no third-party analytics following you around the web.',
  },
  {
    title: 'We do not show your exact location',
    body: 'Coordinates are rounded to two decimals on the way in, and distance is always displayed as a band.',
  },
  {
    title: 'We do not ask for your number',
    body: 'Your phone number is optional and lives in a separate table that other users cannot read.',
  },

  {
    title: 'We do not let anyone contact you uninvited',
    body: 'Both people have to be matched before a conversation can start.',
  },
]

export function LandingPage() {
  return (
    <div className="relative overflow-hidden">
      {/* Ambient background */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-600/10 rounded-full blur-3xl animate-pulse-soft" />
        <div
          className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-accent-gold/10 rounded-full blur-3xl animate-pulse-soft"
          style={{ animationDelay: '1s' }}
        />
      </div>

      {/* Hero */}
      <section className="relative z-10 pt-16 pb-20 sm:pt-24 sm:pb-28 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <p className="inline-flex items-center gap-2 bg-primary-600/10 border border-primary-600/20 rounded-full px-4 py-2 mb-8 animate-fade-in text-sm text-primary-300">
            <span className="w-2 h-2 bg-primary-400 rounded-full animate-pulse-soft" aria-hidden="true" />
            18+ only · verified email · consent-based contact
          </p>

          <h1 className="font-display text-4xl sm:text-6xl font-bold text-dark-50 mb-6 animate-slide-up">
            Find your <span className="gradient-text">perfect match</span>
          </h1>

          <p
            className="text-lg sm:text-xl text-dark-300 max-w-2xl mx-auto mb-10 animate-slide-up"
            style={{ animationDelay: '100ms' }}
          >
            A dating community built around the two things that matter most: your privacy, and
            conversations that actually go somewhere. Free to join, and free to leave.
          </p>

          <div
            className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up"
            style={{ animationDelay: '200ms' }}
          >
            <Link to="/auth/signup" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto gap-2">
                <Heart className="w-5 h-5" aria-hidden="true" />
                Create your account
              </Button>
            </Link>
            <Link to="/auth/login" className="w-full sm:w-auto">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                I already have an account
              </Button>
            </Link>
          </div>

          <ul
            className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-dark-400 text-sm mt-10 animate-fade-in"
            style={{ animationDelay: '300ms' }}
          >
            {[
              'Row-level security on every table',
              '18+ enforced in the database',
              'No card required',
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-primary-400 shrink-0" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Principles */}
      <section className="relative z-10 py-16 px-4 sm:px-6 lg:px-8 border-y border-dark-800">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-dark-50">
              Four things we do not do
            </h2>
            <p className="text-dark-400 mt-4 max-w-2xl mx-auto">
              The privacy promises most dating apps make are the ones they break first. These are
              enforced in the schema, not just in the copy.
            </p>
          </div>

          <ul className="grid sm:grid-cols-2 gap-6">
            {principles.map((principle, index) => (
              <li
                key={principle.title}
                className="glass rounded-2xl p-6 animate-fade-in"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <h3 className="font-display text-lg font-semibold text-dark-50 mb-2">
                  {principle.title}
                </h3>
                <p className="text-dark-400 leading-relaxed">{principle.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 py-20 sm:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-dark-50 mb-4">
              How it works
            </h2>
            <p className="text-dark-400 text-lg max-w-2xl mx-auto">
              Every feature below is switched on in the version you are using.
            </p>
          </div>

          <ul className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <li key={feature.title}>
                <Card
                  variant="hover"
                  padding="lg"
                  className="h-full animate-fade-in"
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <div className="w-12 h-12 rounded-xl bg-primary-600/10 flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-primary-400" aria-hidden="true" />
                  </div>
                  <h3 className="font-display text-xl font-semibold text-dark-50 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-dark-400 leading-relaxed">{feature.description}</p>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 py-20 sm:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <Card variant="glass-strong" padding="xl" className="relative overflow-hidden">
            <div
              className="absolute inset-0 bg-gradient-to-r from-primary-600/10 via-transparent to-accent-gold/10"
              aria-hidden="true"
            />
            <div className="relative">
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-dark-50 mb-4">
                Ready to meet someone worth meeting?
              </h2>
              <p className="text-dark-400 text-lg mb-8 max-w-xl mx-auto">
                Creating an account takes a couple of minutes, needs no card, and you can ask us to
                delete everything we hold about you at any time.
              </p>
              <Link to="/auth/signup" className="inline-block">
                <Button size="lg" className="w-full sm:w-auto gap-2">
                  <Heart className="w-5 h-5" aria-hidden="true" />
                  Create your account
                  <ArrowRight className="w-5 h-5" aria-hidden="true" />
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </section>
    </div>
  )
}
