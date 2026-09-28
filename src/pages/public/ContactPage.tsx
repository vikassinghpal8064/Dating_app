import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import {
  AlertCircle,
  CheckCircle2,
  Lock,
  Mail,
  MessageSquare,
  Send,
  Shield,
} from 'lucide-react'
import { Button, Card, Input, Select, Textarea } from '../../components/ui'
import { PageContainer, PageHeader, Section } from '../../components/ui'
import { supabase } from '../../lib/supabase'

const contactSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().trim().email('Invalid email address'),
  subject: z.enum(['general', 'safety', 'privacy', 'billing', 'technical', 'press', 'other']),
  message: z
    .string()
    .trim()
    .min(10, 'Message must be at least 10 characters')
    .max(2000, 'Message must be under 2000 characters'),
})

type ContactForm = z.infer<typeof contactSchema>

const subjectOptions = [
  { value: 'general', label: 'General enquiry' },
  { value: 'safety', label: 'Safety concern' },
  { value: 'privacy', label: 'Privacy or data request' },
  { value: 'billing', label: 'Billing or subscription' },
  { value: 'technical', label: 'Technical issue' },
  { value: 'press', label: 'Press or media' },
  { value: 'other', label: 'Something else' },
]

const channels = [
  {
    icon: Mail,
    title: 'General support',
    body: 'support@heartconnect.app',
    note: 'We reply within two working days.',
    tone: 'text-primary-400 bg-primary-600/10',
  },
  {
    icon: Shield,
    title: 'Safety reports',
    body: 'safety@heartconnect.app',
    note: 'Use the in-app report button for anything urgent — it reaches moderators directly.',
    tone: 'text-accent-emerald bg-accent-emerald/10',
  },
  {
    icon: Lock,
    title: 'Privacy requests',
    body: 'privacy@heartconnect.app',
    note: 'Access, correction or deletion requests. We reply within 30 days.',
    tone: 'text-accent-gold bg-accent-gold/10',
  },
]

export function ContactPage() {
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ContactForm>({
    resolver: zodResolver(contactSchema),
    defaultValues: { subject: 'general' },
  })

  const onSubmit = async (data: ContactForm) => {
    setSubmitting(true)
    setError('')

    try {
      // Delivered by a Supabase Edge Function so the message is never written
      // to a table the browser role can read back.
      const { error: invokeError } = await supabase.functions.invoke('contact', {
        body: data,
      })

      if (invokeError) throw invokeError

      setSubmitted(true)
      reset()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'We could not send that. Please try again or email us directly.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Section padding="lg">
      <PageContainer variant="narrow">
        <PageHeader
          title="Contact us"
          subtitle="Questions, safety reports or a privacy request — we read everything."
        />

        {submitted ? (
          <Card variant="glass-strong" padding="lg">
            <div className="space-y-6 text-center animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-accent-emerald/10 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-accent-emerald" aria-hidden="true" />
              </div>
              <div>
                <h2 className="font-display text-xl font-semibold text-dark-50">Message sent</h2>
                <p className="mt-2 text-dark-400 text-sm">
                  Thanks for reaching out. We answer general enquiries within two working days.
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => setSubmitted(false)}
              >
                <MessageSquare className="w-4 h-4 mr-2" aria-hidden="true" />
                Send another message
              </Button>
            </div>
          </Card>
        ) : (
          <Card variant="glass-strong" padding="lg">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
              {error && (
                <div
                  className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm"
                  role="alert"
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                <Input
                  label="Name"
                  placeholder="Your name"
                  error={errors.name?.message}
                  {...register('name')}
                  required
                  autoComplete="name"
                />
                <Input
                  label="Email"
                  type="email"
                  placeholder="you@example.com"
                  error={errors.email?.message}
                  {...register('email')}
                  required
                  autoComplete="email"
                />
              </div>

              <Select
                label="Topic"
                options={subjectOptions}
                error={errors.subject?.message}
                {...register('subject')}
                required
              />

              <Textarea
                label="Message"
                placeholder="Tell us what you need — include anything that will help us help you."
                error={errors.message?.message}
                {...register('message')}
                required
                rows={6}
              />

              <Button type="submit" className="w-full" size="lg" loading={submitting}>
                {!submitting && <Send className="w-5 h-5 mr-2" aria-hidden="true" />}
                {submitting ? 'Sending…' : 'Send message'}
              </Button>

              <p className="text-center text-dark-500 text-sm">
                Prefer email? Write to{' '}
                <a
                  href="mailto:support@heartconnect.app"
                  className="text-primary-400 hover:underline"
                >
                  support@heartconnect.app
                </a>
              </p>
            </form>
          </Card>
        )}
      </PageContainer>

      <Section padding="lg">
        <PageContainer variant="narrow">
          <ul className="grid md:grid-cols-3 gap-6">
            {channels.map((channel) => (
              <li key={channel.title} className="glass rounded-2xl p-6 text-center">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 ${channel.tone}`}
                >
                  <channel.icon className="w-6 h-6" aria-hidden="true" />
                </div>
                <h3 className="font-display text-lg font-semibold text-dark-50 mb-2">
                  {channel.title}
                </h3>
                <p className="text-dark-300 text-sm mb-3 break-words">{channel.body}</p>
                <p className="text-dark-500 text-xs leading-relaxed">{channel.note}</p>
              </li>
            ))}
          </ul>
        </PageContainer>
      </Section>
    </Section>
  )
}
