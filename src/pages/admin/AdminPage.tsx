import { useCallback, useEffect, useState } from 'react'
import {
  Check,
  Flag,
  Image as ImageIcon,
  LayoutDashboard,
  MessageSquare,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react'
import {
  PageContainer,
  PageHeader,
  Tabs,
  Button,
  Avatar,
  Textarea,
  Modal,
} from '../../components/ui'
import type { TabItem } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import { MessagesTab } from './MessagesTab'
import { OverviewTab } from './OverviewTab'
import { UsersTab } from './UsersTab'

const adminTabs: TabItem[] = [
  { value: 'overview', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
  { value: 'users', label: 'Users', icon: <Users className="h-4 w-4" /> },
  { value: 'messages', label: 'Messages', icon: <MessageSquare className="h-4 w-4" /> },
  { value: 'reports', label: 'Reports', icon: <Flag className="h-4 w-4" /> },
  { value: 'photos', label: 'Photos', icon: <ImageIcon className="h-4 w-4" /> },
  { value: 'verification', label: 'Verification', icon: <ShieldCheck className="h-4 w-4" /> },
]

interface Report {
  id: string
  reporter_id: string
  reported_id: string
  reason: string
  details: string | null
  status: string
  created_at: string
  reported_profile: {
    id: string
    full_name: string
    age: number
    photos: string[]
  }
}

interface Photo {
  id: string
  user_id: string
  storage_path: string
  photo_position: number
  moderation_status: string
  created_at: string
  user_profile: {
    id: string
    full_name: string
    age: number
  }
}

interface Verification {
  id: string
  user_id: string
  storage_path: string
  pose_prompt: string
  status: string
  created_at: string
  user_profile: {
    id: string
    full_name: string
    age: number
    is_verified: boolean
  }
}

export function AdminPage() {
  const [activeTab, setActiveTab] = useState('overview')

  return (
    <PageContainer>
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Admin"
          subtitle="Owner analytics, member records and moderation in one place."
        />
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
        className="mb-6 flex-wrap sm:flex-nowrap"
      />

      <div className="focus-visible:outline-none">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'messages' && <MessagesTab />}
        {activeTab === 'reports' && <ReportsTab />}
        {activeTab === 'photos' && <PhotosTab />}
        {activeTab === 'verification' && <VerificationTab />}
      </div>
    </PageContainer>
  )
}

function ReportsTab() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [action, setAction] = useState<'dismiss' | 'warn' | 'ban' | null>(null)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadReports = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.rpc('admin_get_reports_queue')
    if (!error && data) {
      setReports(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadReports()
  }, [loadReports])

  const handleAction = async () => {
    if (!selectedReport || !action) return

    setSubmitting(true)
    try {
      if (action === 'dismiss') {
        await supabase.rpc('admin_set_report_status', {
          p_report: selectedReport.id,
          p_status: 'dismissed',
        })
      } else if (action === 'warn') {
        await supabase.rpc('admin_set_report_status', {
          p_report: selectedReport.id,
          p_status: 'reviewing',
        })
        // Could send warning email here in the future
      } else if (action === 'ban') {
        await supabase.rpc('admin_ban_user', {
          p_user: selectedReport.reported_id,
          p_reason: reason || 'Violation of community guidelines',
        })
        await supabase.rpc('admin_set_report_status', {
          p_report: selectedReport.id,
          p_status: 'actioned',
        })
      }

      setSelectedReport(null)
      setAction(null)
      setReason('')
      await loadReports()
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="text-center text-dark-400">Loading reports...</div>
  }

  return (
    <section className="space-y-4">
      <h2 className="font-display text-xl font-semibold text-dark-50">Reports Queue</h2>
      {reports.length === 0 ? (
        <p className="text-dark-400">No open reports</p>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <div
              key={report.id}
              className="rounded-2xl border border-dark-700 bg-dark-900/60 p-4"
            >
              <div className="flex items-start gap-4">
                <Avatar
                  src={report.reported_profile.photos[0] ?? null}
                  fallback={report.reported_profile.full_name}
                  size="lg"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-dark-50">
                    {report.reported_profile.full_name}, {report.reported_profile.age}
                  </p>
                  <p className="mt-1 text-sm text-dark-400">
                    Reported for: <span className="text-dark-200">{report.reason}</span>
                  </p>
                  {report.details && (
                    <p className="mt-2 text-sm text-dark-300">{report.details}</p>
                  )}
                  <p className="mt-2 text-xs text-dark-500">
                    {new Date(report.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedReport(report)}
                >
                  Review
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedReport && (
        <Modal
          isOpen={true}
          onClose={() => {
            setSelectedReport(null)
            setAction(null)
            setReason('')
          }}
          title="Review Report"
        >
          <div className="space-y-4">
            <div>
              <p className="text-sm text-dark-400">Reported user:</p>
              <p className="font-medium text-dark-100">
                {selectedReport.reported_profile.full_name}
              </p>
            </div>
            <div>
              <p className="text-sm text-dark-400">Reason:</p>
              <p className="text-dark-100">{selectedReport.reason}</p>
            </div>
            {selectedReport.details && (
              <div>
                <p className="text-sm text-dark-400">Details:</p>
                <p className="text-dark-100">{selectedReport.details}</p>
              </div>
            )}

            {action && (
              <div className="space-y-3">
                <Textarea
                  label="Reason (optional)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain your decision..."
                />
                <div className="flex gap-2">
                  <Button onClick={handleAction} loading={submitting}>
                    Confirm
                  </Button>
                  <Button variant="outline" onClick={() => setAction(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {!action && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => setAction('dismiss')}
                >
                  Dismiss
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setAction('warn')}
                >
                  Warn
                </Button>
                <button
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
                  onClick={() => setAction('ban')}
                >
                  Ban User
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </section>
  )
}

function PhotosTab() {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const [action, setAction] = useState<'approve' | 'reject' | null>(null)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})

  const loadPhotos = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.rpc('admin_get_photos_queue')
    if (!error && data) {
      setPhotos(data)
      // Get signed URLs for all photos
      const urls: Record<string, string> = {}
      for (const photo of data) {
        const { data: signedData } = await supabase.storage
          .from('profile-photos')
          .createSignedUrl(photo.storage_path, 3600)
        if (signedData) {
          urls[photo.id] = signedData.signedUrl
        }
      }
      setSignedUrls(urls)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadPhotos()
  }, [loadPhotos])

  const handleAction = async () => {
    if (!selectedPhoto || !action) return

    setSubmitting(true)
    try {
      await supabase.rpc('admin_review_photo', {
        p_photo: selectedPhoto.id,
        p_approve: action === 'approve',
        p_reason: reason || null,
      })

      setSelectedPhoto(null)
      setAction(null)
      setReason('')
      await loadPhotos()
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="text-center text-dark-400">Loading photos...</div>
  }

  return (
    <section className="space-y-4">
      <h2 className="font-display text-xl font-semibold text-dark-50">Photo Moderation</h2>
      {photos.length === 0 ? (
        <p className="text-dark-400">No pending photos</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="overflow-hidden rounded-2xl border border-dark-700 bg-dark-900/60"
            >
              {signedUrls[photo.id] && (
                <img
                  src={signedUrls[photo.id]}
                  alt={`Photo by ${photo.user_profile.full_name}`}
                  className="aspect-square w-full object-cover"
                />
              )}
              <div className="p-4">
                <p className="font-medium text-dark-50">{photo.user_profile.full_name}</p>
                <p className="text-sm text-dark-400">Age {photo.user_profile.age}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() => setSelectedPhoto(photo)}
                >
                  Review
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedPhoto && (
        <Modal
          isOpen={true}
          onClose={() => {
            setSelectedPhoto(null)
            setAction(null)
            setReason('')
          }}
          title="Review Photo"
        >
          <div className="space-y-4">
            {signedUrls[selectedPhoto.id] && (
              <img
                src={signedUrls[selectedPhoto.id]}
                alt="Photo for review"
                className="w-full rounded-lg"
              />
            )}
            <div>
              <p className="text-sm text-dark-400">User:</p>
              <p className="font-medium text-dark-100">
                {selectedPhoto.user_profile.full_name}
              </p>
            </div>

            {action && (
              <div className="space-y-3">
                <Textarea
                  label="Reason (optional)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain your decision..."
                />
                <div className="flex gap-2">
                  <Button onClick={handleAction} loading={submitting}>
                    Confirm
                  </Button>
                  <Button variant="outline" onClick={() => setAction(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {!action && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setAction('reject')}
                  className="flex-1"
                >
                  <X className="mr-2 h-4 w-4" />
                  Reject
                </Button>
                <Button
                  onClick={() => setAction('approve')}
                  className="flex-1"
                >
                  <Check className="mr-2 h-4 w-4" />
                  Approve
                </Button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </section>
  )
}

function VerificationTab() {
  const [verifications, setVerifications] = useState<Verification[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedVerification, setSelectedVerification] = useState<Verification | null>(null)
  const [action, setAction] = useState<'approve' | 'reject' | null>(null)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})

  const loadVerifications = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.rpc('admin_get_verification_queue')
    if (!error && data) {
      setVerifications(data)
      // Get signed URLs for all verification photos
      const urls: Record<string, string> = {}
      for (const verification of data) {
        const { data: signedData } = await supabase.storage
          .from('verification-selfies')
          .createSignedUrl(verification.storage_path, 3600)
        if (signedData) {
          urls[verification.id] = signedData.signedUrl
        }
      }
      setSignedUrls(urls)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadVerifications()
  }, [loadVerifications])

  const handleAction = async () => {
    if (!selectedVerification || !action) return

    setSubmitting(true)
    try {
      await supabase.rpc('admin_review_verification', {
        p_request: selectedVerification.id,
        p_approve: action === 'approve',
        p_reason: reason || null,
      })

      setSelectedVerification(null)
      setAction(null)
      setReason('')
      await loadVerifications()
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="text-center text-dark-400">Loading verifications...</div>
  }

  return (
    <section className="space-y-4">
      <h2 className="font-display text-xl font-semibold text-dark-50">Verification Queue</h2>
      {verifications.length === 0 ? (
        <p className="text-dark-400">No pending verifications</p>
      ) : (
        <div className="space-y-3">
          {verifications.map((verification) => (
            <div
              key={verification.id}
              className="rounded-2xl border border-dark-700 bg-dark-900/60 p-4"
            >
              <div className="flex items-start gap-4">
                {signedUrls[verification.id] && (
                  <img
                    src={signedUrls[verification.id]}
                    alt="Verification selfie"
                    className="h-20 w-20 rounded-lg object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-dark-50">
                    {verification.user_profile.full_name}, {verification.user_profile.age}
                  </p>
                  <p className="mt-1 text-sm text-dark-400">
                    Pose: <span className="text-dark-200">{verification.pose_prompt}</span>
                  </p>
                  <p className="mt-1 text-xs text-dark-500">
                    {new Date(verification.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedVerification(verification)}
                >
                  Review
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedVerification && (
        <Modal
          isOpen={true}
          onClose={() => {
            setSelectedVerification(null)
            setAction(null)
            setReason('')
          }}
          title="Review Verification"
        >
          <div className="space-y-4">
            {signedUrls[selectedVerification.id] && (
              <img
                src={signedUrls[selectedVerification.id]}
                alt="Verification selfie"
                className="w-full rounded-lg"
              />
            )}
            <div>
              <p className="text-sm text-dark-400">User:</p>
              <p className="font-medium text-dark-100">
                {selectedVerification.user_profile.full_name}
              </p>
            </div>
            <div>
              <p className="text-sm text-dark-400">Pose instruction:</p>
              <p className="text-dark-100">{selectedVerification.pose_prompt}</p>
            </div>

            {action && (
              <div className="space-y-3">
                <Textarea
                  label="Reason (optional)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain your decision..."
                />
                <div className="flex gap-2">
                  <Button onClick={handleAction} loading={submitting}>
                    Confirm
                  </Button>
                  <Button variant="outline" onClick={() => setAction(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {!action && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setAction('reject')}
                  className="flex-1"
                >
                  <X className="mr-2 h-4 w-4" />
                  Reject
                </Button>
                <Button
                  onClick={() => setAction('approve')}
                  className="flex-1"
                >
                  <Check className="mr-2 h-4 w-4" />
                  Approve
                </Button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </section>
  )
}
