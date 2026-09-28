import { Section, PageContainer, PageHeader, Button } from '../../components/ui'
import { Shield, AlertTriangle, Phone, User, Flag, MessageSquare, Lock, Info } from 'lucide-react'

const safetyTips = [
  {
    icon: Shield,
    title: 'Protect Your Personal Information',
    description: 'Never share your phone number, home address, workplace, financial details, or passwords with matches until you\'ve built trust. HeartConnect keeps your contact info private by default.',
  },
  {
    icon: User,
    title: 'Take Your Time',
    description:
      'There is no video chat and no identity check in this build, so do not treat a profile as proof of anything. Talk for as long as you need before agreeing to meet, and change your mind at any point without giving a reason.',
  },
  {
    icon: Flag,
    title: 'Meet in Public Places',
    description: 'Always meet in busy, public locations like cafes, restaurants, or parks. Tell a friend or family member where you\'re going and when you expect to return.',
  },
  {
    icon: Phone,
    title: 'Control Your Transportation',
    description: 'Drive yourself or use rideshare/taxi. Don\'t get into a car with someone you just met. Keep your phone charged and accessible.',
  },
  {
    icon: MessageSquare,
    title: 'Stay on the Platform',
    description: 'Keep conversations on HeartConnect until you feel comfortable. Scammers often try to move to WhatsApp, Telegram, or email immediately.',
  },
  {
    icon: Lock,
    title: 'Tell Us, by Email',
    description:
      'If someone asks for money, gift cards or crypto, or if a profile is fake or the behaviour is harassing, email safety@heartconnect.app. There is no in-app report button in this build, and no moderation queue behind it, so a report only reaches a human if you send it.',
  },
]

const redFlags = [
  'Asks for money, gift cards, or financial help — ever',
  'Claims to be in crisis or emergency needing immediate funds',
  'Wants to move to another platform immediately',
  'Profile photos look too professional or inconsistent',
  'Avoids video chat or makes excuses',
  'Pressures you for personal information',
  'Claims to be from your area but has poor local knowledge',
  'Overly romantic too quickly (love bombing)',
]

export function SafetyPage() {
  return (
    <div className="min-h-screen bg-dark-950">
      <Section padding="xl">
        <PageContainer variant="narrow">
          <PageHeader
            title="Safety Center"
            subtitle="Your safety is our top priority. Learn how to protect yourself and others while dating online."
          />
          
          <div className="glass-strong rounded-2xl p-6 mb-12 border border-primary-500/20 bg-primary-600/5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary-600/20 flex items-center justify-center flex-shrink-0">
                <Info className="w-6 h-6 text-primary-400" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold text-dark-50 mb-2">
                  What we can and cannot do
                </h3>
                <p className="text-dark-400 text-sm">
                  The advice below is practical guidance, not legal advice, and it is not a promise
                  about how this platform will be staffed. What the software genuinely enforces is
                  narrow and worth stating plainly: row-level security on every table, 18+ accounts
                  only, phone numbers held separately and released only with consent, and distances
                  shown as bands rather than exact locations.
                </p>
              </div>
            </div>
          </div>
        </PageContainer>
      </Section>

      <Section padding="xl">
        <PageContainer variant="narrow">
          <div className="space-y-8">
            {safetyTips.map((tip, index) => (
              <div key={tip.title} className="glass rounded-2xl p-6 hover:border-dark-600 transition-all duration-300 animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary-600/10 flex items-center justify-center flex-shrink-0">
                    <tip.icon className="w-6 h-6 text-primary-400" />
                  </div>
                  <div>
                    <h3 className="font-display text-xl font-semibold text-dark-50 mb-2">{tip.title}</h3>
                    <p className="text-dark-400 leading-relaxed">{tip.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </PageContainer>
      </Section>

      <Section padding="xl">
        <PageContainer variant="narrow">
          <div className="glass-strong rounded-2xl p-8">
            <h2 className="font-display text-2xl font-bold text-dark-50 mb-6">🚩 Red Flags — Never Ignore These</h2>
            <ul className="space-y-3">
              {redFlags.map((flag, index) => (
                <li key={index} className="flex items-center gap-3 text-dark-300">
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <span>{flag}</span>
                </li>
              ))}
            </ul>
          </div>
        </PageContainer>
      </Section>

      <Section padding="xl">
        <PageContainer variant="narrow">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="glass rounded-2xl p-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <Flag className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="font-display text-lg font-semibold text-dark-50 mb-2">Report & Block</h3>
              <p className="text-dark-400 text-sm mb-4">Found someone suspicious? Report them instantly. Block prevents all future contact.</p>
              <Button variant="outline" size="sm">Learn How</Button>
            </div>
            <div className="glass rounded-2xl p-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-accent-emerald/10 flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-accent-emerald" />
              </div>
              <h3 className="font-display text-lg font-semibold text-dark-50 mb-2">Profile Verification</h3>
              <p className="text-dark-400 text-sm mb-4">Verified profiles have a blue badge. Request verification in Settings.</p>
              <Button variant="outline" size="sm">Get Verified</Button>
            </div>
            <div className="glass rounded-2xl p-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary-600/10 flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-primary-400" />
              </div>
              <h3 className="font-display text-lg font-semibold text-dark-50 mb-2">Privacy Controls</h3>
              <p className="text-dark-400 text-sm mb-4">Control who sees your distance, last active status, and profile. Pause anytime.</p>
              <Button variant="outline" size="sm">Manage Privacy</Button>
            </div>
          </div>
        </PageContainer>
      </Section>

      <Section padding="xl">
        <PageContainer variant="narrow">
          <div className="glass-strong rounded-2xl p-8 text-center border border-primary-500/20">
            <h2 className="font-display text-2xl font-bold text-dark-50 mb-4">Emergency Resources</h2>
            <p className="text-dark-400 mb-6 max-w-2xl mx-auto">
              If you’re in immediate danger, call emergency services (911 in US, 112 in EU, 999 in UK) right away.
            </p>
            <div className="grid sm:grid-cols-2 gap-4 max-w-md mx-auto">
              <a href="https://www.rainn.org" target="_blank" rel="noopener noreferrer" className="glass rounded-xl p-4 text-left hover:border-dark-600 transition-colors">
                <h3 className="font-semibold text-dark-50">RAINN (US)</h3>
                <p className="text-dark-400 text-sm">Sexual assault support</p>
              </a>
              <a href="https://www.thehotline.org" target="_blank" rel="noopener noreferrer" className="glass rounded-xl p-4 text-left hover:border-dark-600 transition-colors">
                <h3 className="font-semibold text-dark-50">Domestic Violence Hotline</h3>
                <p className="text-dark-400 text-sm">24/7 confidential support</p>
              </a>
            </div>
          </div>
        </PageContainer>
      </Section>
    </div>
  )
}