import { Link } from 'react-router-dom'
import { Heart, Lock, Mail, Shield, Users } from 'lucide-react'
import { cn } from '../../utils'

interface FooterLink {
  label: string
  to: string
}

export function Footer({ className }: { className?: string }) {
  /* Every destination here is a real route. Dead links are worse than no
     links, so anything the app does not serve is simply not listed. */
  const groups: { heading: string; links: FooterLink[] }[] = [
    {
      heading: 'Product',
      links: [
        { label: 'Discover', to: '/app/discover' },
        { label: 'Search', to: '/app/search' },
        { label: 'Matches', to: '/app/matches' },
        { label: 'Messages', to: '/app/messages' },
      ],
    },
    {
      heading: 'Company',
      links: [
        { label: 'About', to: '/about' },
        { label: 'Safety', to: '/safety' },
        { label: 'Contact us', to: '/contact' },
      ],
    },
    {
      heading: 'Legal',
      links: [
        { label: 'Privacy policy', to: '/privacy' },
        { label: 'Terms of service', to: '/terms' },
      ],
    },
    {
      heading: 'Account',
      links: [
        { label: 'Sign in', to: '/auth/login' },
        { label: 'Create account', to: '/auth/signup' },
      ],
    },
  ]

  /* Each mark here is enforced by the database, not by this page, and each was
     checked against the schema before being claimed. "Location kept private"
     replaces an earlier "Moderated profiles": photos are written by the member
     and published without review, so the honest claim is the one the schema
     actually makes — coordinates are rounded to two decimals on the way in and
     never published, and distance is shown as a rounded band or withheld. */
  const trustMarks = [
    { icon: Shield, label: 'Location kept private' },
    { icon: Lock, label: 'Encrypted in transit' },
    { icon: Users, label: '18+ only' },
  ]

  return (
    <footer className={cn('glass-strong border-t border-dark-800', className)}>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 lg:gap-12 mb-12">
          <div className="col-span-2 md:col-span-1">
            <Link
              to="/"
              className="inline-flex items-center gap-2 mb-4"
              aria-label="HeartConnect home"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700">
                <Heart className="w-6 h-6 text-white" aria-hidden="true" />
              </span>
              <span className="font-display text-xl font-bold text-dark-50">HeartConnect</span>
            </Link>
            <p className="text-dark-400 text-sm mb-6 max-w-xs">
              A privacy-first dating community for people who would rather meet one good person than
              swipe a thousand times.
            </p>
            <a
              href="mailto:support@heartconnect.app"
              className="inline-flex items-center gap-2 text-sm text-dark-400 transition-colors hover:text-primary-400"
            >
              <Mail className="w-4 h-4" aria-hidden="true" />
              support@heartconnect.app
            </a>
          </div>

          {groups.map((group) => (
            <nav key={group.heading} aria-labelledby={`footer-${group.heading}`}>
              <h2
                id={`footer-${group.heading}`}
                className="font-medium text-dark-50 mb-4 text-sm uppercase tracking-wide"
              >
                {group.heading}
              </h2>
              <ul className="space-y-3">
                {group.links.map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className="text-dark-400 hover:text-primary-400 text-sm transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="pt-8 border-t border-dark-800">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-dark-500 text-sm">
              © {new Date().getFullYear()} HeartConnect. All rights reserved.
            </p>
            <ul className="flex flex-wrap items-center justify-center gap-6 text-sm text-dark-500">
              {trustMarks.map((mark) => (
                <li key={mark.label} className="flex items-center gap-2">
                  <mark.icon className="w-4 h-4" aria-hidden="true" />
                  {mark.label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </footer>
  )
}
