import { Section, PageContainer, PageHeader } from '../../components/ui'
import { Shield, Gavel, User, Ban, AlertTriangle, Info } from 'lucide-react'

const termsSections = [
  {
    icon: Shield,
    title: 'Eligibility',
    content: 'You must be 18 years or older to use HeartConnect. The sign-up form refuses a date of birth that makes you under 18, and the database has its own check on the same column, so there is no way around it. One account per person.',
  },
  {
    icon: User,
    title: 'Your Account',
    content: 'You are responsible for your account credentials and all activity. Use a strong password, do not share your login, and notify us immediately of any unauthorized access.',
  },
  {
    icon: Gavel,
    title: 'Acceptable Use',
    items: [
      'Be respectful and kind to other members',
      'Use real photos of yourself — no celebrities, cartoons or fake images',
      'Provide accurate information about yourself',
      'Communicate only through HeartConnect until you agree otherwise',
      'Do not attempt to bypass the privacy controls described here',
    ],
    prohibited: [
      'Harassment, hate speech, threats or bullying',
      'Nudity, sexual content or sexually explicit messages',
      'Solicitation, prostitution or commercial sexual services',
      'Scams, fraud, or requests for money, gift cards or crypto',
      'Fake profiles, impersonation or catfishing',
      'Sharing private information without consent',
      'Spam, marketing or promotional content',
      'Illegal activities or content',
      'Automated scripts, bots or scraping',
      'Attempting to bypass security or row-level security',
    ],
  },
  {
    icon: Ban,
    title: 'Enforcement, as it stands today',
    content:
      'This build has no automated moderation, no report queue and no self-service ban. A breach of these terms is handled by us suspending the account by hand, and you can reach us to report a member by email. This is stated plainly because describing an enforcement system that does not exist would leave you with a false idea of what protects you.',
  },
  {
    icon: AlertTriangle,
    title: 'Disclaimers',
    items: [
      'HeartConnect is a platform for introductions — we do not guarantee matches or outcomes',
      'We do not verify identity, and there is no selfie or ID check in this build',
      'We do not run background checks on any member',
      'Meeting strangers carries inherent risks — follow our safety guidance',
      'Service provided "as is" without warranties of any kind',
      'We are not liable for user interactions, meetings or relationships',
    ],
  },
  {
    icon: Info,
    title: 'Leaving, and changes to these terms',
    content:
      'Self-service account deletion is not built yet; email us and we will action the request and everything it implies. We may terminate accounts that breach these terms. We may update these terms, and will post the change here with 30 days notice. Continued use after that constitutes acceptance.',
  },
]

export function TermsPage() {
  return (
    <div className="min-h-screen bg-dark-950">
      <Section padding="xl">
        <PageContainer variant="narrow">
          <PageHeader
            title="Terms of Service"
            subtitle="The rules of the road. Please read carefully before using HeartConnect."
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
                  These terms describe the service as it is actually built, including the parts
                  that are not finished yet. They have not been through legal review. Before you
                  open registrations, have them checked against the consumer protection and data
                  protection rules that apply in every country you intend to serve.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            {termsSections.map((section, index) => (
              <div key={section.title} className="glass rounded-2xl p-6 animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-primary-600/10 flex items-center justify-center flex-shrink-0">
                    <section.icon className="w-6 h-6 text-primary-400" />
                  </div>
                  <h2 className="font-display text-xl font-semibold text-dark-50 mt-1">{section.title}</h2>
                </div>
                {section.content && (
                  <p className="text-dark-300 leading-relaxed mb-4">{section.content}</p>
                )}
                {section.items && (
                  <ul className="space-y-2">
                    {section.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-dark-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary-500 flex-shrink-0 mt-2" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {section.prohibited && (
                  <>
                    <p className="text-dark-300 leading-relaxed mb-3">Prohibited:</p>
                    <ul className="space-y-2">
                      {section.prohibited.map((item, i) => (
                        <li key={i} className="flex items-start gap-3 text-red-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0 mt-2" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="mt-12 glass rounded-2xl p-6 border border-dark-700">
            <h3 className="font-display text-lg font-semibold text-dark-50 mb-4">Questions?</h3>
            <p className="text-dark-400">
              Contact us at <a href="mailto:legal@heartconnect.app" className="text-primary-400 hover:underline">legal@heartconnect.app</a>
            </p>
            <p className="text-dark-500 text-sm mt-2">
              Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </PageContainer>
      </Section>
    </div>
  )
}