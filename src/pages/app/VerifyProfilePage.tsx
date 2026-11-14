import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Camera, CheckCircle, XCircle, Clock, Upload } from 'lucide-react'
import {
  Button,
  PageContainer,
  PageHeader,
  InlineMessage,
} from '../../components/ui'
import { useAuth } from '../../lib/authContext'
import { supabase } from '../../lib/supabase'

const POSE_PROMPTS = [
  'Thumbs up next to your face',
  'Smiling broadly',
  'Peace sign',
  'Hand on heart',
  'Waving hello',
  'Touching your ear',
  'Looking to the side',
  'Neutral expression',
]

interface VerificationRequest {
  id: string
  status: 'pending' | 'approved' | 'rejected'
  reason?: string | null
  created_at: string
}

export function VerifyProfilePage() {
  const { user } = useAuth()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [currentPrompt, setCurrentPrompt] = useState('')
  const [capturedImage, setCapturedImage] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [existingRequest, setExistingRequest] = useState<VerificationRequest | null>(null)
  const [loading, setLoading] = useState(true)

  // Load existing verification request
  useEffect(() => {
    async function loadExisting() {
      if (!user) return

      const { data } = await supabase
        .from('verification_requests')
        .select('id, status, reason, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (data) {
        setExistingRequest(data)
      }
      setLoading(false)
    }

    void loadExisting()
  }, [user])

  // Set random pose prompt
  useEffect(() => {
    const randomPrompt = POSE_PROMPTS[Math.floor(Math.random() * POSE_PROMPTS.length)]
    setCurrentPrompt(randomPrompt)
  }, [])

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      setError(null)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setCameraActive(true)
      }
    } catch {
      setError('Could not access camera. Please allow camera access or use file upload.')
    }
  }, [])

  // Stop camera
  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
      videoRef.current.srcObject = null
      setCameraActive(false)
    }
  }, [])

  // Capture photo
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')

    if (!context) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    context.drawImage(video, 0, 0)

    canvas.toBlob(
      (blob) => {
        if (blob) {
          setCapturedImage(blob)
          setPreviewUrl(URL.createObjectURL(blob))
          stopCamera()
        }
      },
      'image/jpeg',
      0.8
    )
  }, [stopCamera])

  // Handle file upload
  const handleFileSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be less than 10MB')
      return
    }

    setCapturedImage(file)
    setPreviewUrl(URL.createObjectURL(file))
  }, [])

  // Upload verification
  const handleUpload = useCallback(async () => {
    if (!capturedImage || !user || !currentPrompt) return

    setUploading(true)
    setError(null)

    try {
      // Upload to storage
      const fileName = `${user.id}/${Date.now()}.jpg`
      const { error: uploadError } = await supabase.storage
        .from('verification-selfies')
        .upload(fileName, capturedImage, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) throw uploadError

      // Create verification request
      const { error: insertError } = await supabase.from('verification_requests').insert({
        user_id: user.id,
        storage_path: fileName,
        pose_prompt: currentPrompt,
        status: 'pending',
      })

      if (insertError) throw insertError

      setSuccess(true)
      setCapturedImage(null)
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
      setPreviewUrl(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }, [capturedImage, user, currentPrompt, previewUrl])

  // Cleanup
  useEffect(() => {
    return () => {
      stopCamera()
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [stopCamera, previewUrl])

  if (loading) {
    return (
      <PageContainer variant="narrow">
        <PageHeader title="Profile Verification" subtitle="Checking your verification status…" />
      </PageContainer>
    )
  }

  // Show existing request status
  if (existingRequest && !success) {
    const statusConfig = {
      pending: {
        icon: <Clock className="h-12 w-12 text-yellow-400" />,
        title: 'Verification Pending',
        description: 'Your verification request is being reviewed by our team. This usually takes 24-48 hours.',
        bgColor: 'bg-yellow-500/10',
        borderColor: 'border-yellow-500/30',
      },
      approved: {
        icon: <CheckCircle className="h-12 w-12 text-green-400" />,
        title: 'Verified',
        description: 'Your profile has been verified! You now have a verified badge on your profile.',
        bgColor: 'bg-green-500/10',
        borderColor: 'border-green-500/30',
      },
      rejected: {
        icon: <XCircle className="h-12 w-12 text-red-400" />,
        title: 'Verification Rejected',
        description: existingRequest.reason || 'Your verification request was not approved. Please try again with a clearer photo.',
        bgColor: 'bg-red-500/10',
        borderColor: 'border-red-500/30',
      },
    }

    const config = statusConfig[existingRequest.status]

    return (
      <PageContainer variant="narrow">
        <PageHeader
          title="Profile Verification"
          subtitle="Verify your identity to build trust with other members"
        />

        <div className={`rounded-2xl border ${config.borderColor} ${config.bgColor} p-8 text-center`}>
          <div className="mb-4 flex justify-center">{config.icon}</div>
          <h2 className="font-display text-2xl font-bold text-dark-50">{config.title}</h2>
          <p className="mt-3 text-dark-300">{config.description}</p>

          {existingRequest.status === 'rejected' && (
            <Button
              className="mt-6"
              onClick={() => {
                setExistingRequest(null)
                const randomPrompt = POSE_PROMPTS[Math.floor(Math.random() * POSE_PROMPTS.length)]
                setCurrentPrompt(randomPrompt)
              }}
            >
              Try Again
            </Button>
          )}
        </div>
      </PageContainer>
    )
  }

  // Show success
  if (success) {
    return (
      <PageContainer variant="narrow">
        <PageHeader
          title="Profile Verification"
          subtitle="Verify your identity to build trust with other members"
        />

        <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-8 text-center">
          <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-400" />
          <h2 className="font-display text-2xl font-bold text-dark-50">Request Submitted</h2>
          <p className="mt-3 text-dark-300">
            Your verification request has been submitted and is being reviewed. This usually takes 24-48 hours.
          </p>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer variant="narrow">
      <PageHeader
        title="Profile Verification"
        subtitle="Verify your identity to build trust with other members"
      />

      {error && <InlineMessage tone="error">{error}</InlineMessage>}

      {/* Pose prompt */}
      <div className="mb-6 rounded-2xl border border-primary-500/30 bg-primary-600/10 p-6">
        <p className="text-sm text-primary-300">Please follow this instruction:</p>
        <p className="mt-2 font-display text-xl font-semibold text-dark-50">{currentPrompt}</p>
      </div>

      {/* Camera or preview */}
      {!previewUrl ? (
        <div className="space-y-4">
          {/* Camera view */}
          {cameraActive && (
            <div className="relative overflow-hidden rounded-2xl border border-dark-700 bg-dark-900">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full"
              />
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3">
                <Button onClick={capturePhoto} size="lg">
                  <Camera className="mr-2 h-5 w-5" />
                  Capture
                </Button>
                <Button variant="outline" onClick={stopCamera}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          {!cameraActive && (
            <div className="flex flex-col gap-3">
              <Button onClick={startCamera} size="lg">
                <Camera className="mr-2 h-5 w-5" />
                Take Photo with Camera
              </Button>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                size="lg"
              >
                <Upload className="mr-2 h-5 w-5" />
                Upload Photo
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => handleFileSelect(e)}
                className="hidden"
              />
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Preview */}
          <div className="overflow-hidden rounded-2xl border border-dark-700">
            <img src={previewUrl} alt="Verification preview" className="w-full" />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              onClick={handleUpload}
              loading={uploading}
              className="flex-1"
              size="lg"
            >
              Submit Verification
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setCapturedImage(null)
                if (previewUrl) {
                  URL.revokeObjectURL(previewUrl)
                }
                setPreviewUrl(null)
              }}
              disabled={uploading}
            >
              Retake
            </Button>
          </div>
        </div>
      )}

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Instructions */}
      <div className="mt-8 rounded-2xl border border-dark-700 bg-dark-900/60 p-6">
        <h3 className="font-display text-lg font-semibold text-dark-50">Verification Guidelines</h3>
        <ul className="mt-3 space-y-2 text-sm text-dark-300">
          <li>• Your face must be clearly visible and match your profile photos</li>
          <li>• Good lighting and a neutral background work best</li>
          <li>• No sunglasses, masks, or heavy filters</li>
          <li>• Follow the pose instruction shown above</li>
          <li>• Photos are reviewed by our team and kept private</li>
        </ul>
      </div>
    </PageContainer>
  )
}
