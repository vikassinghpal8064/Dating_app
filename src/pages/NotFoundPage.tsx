import { Link } from 'react-router-dom'
import { PageContainer, Button } from '../components/ui'
import { Heart, Home, Sparkles } from 'lucide-react'

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center px-4">
      <PageContainer variant="narrow">
        <div className="text-center py-16 animate-fade-in">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center mx-auto mb-8">
            <Sparkles className="w-12 h-12 text-white" />
          </div>
          <h1 className="font-display text-5xl sm:text-7xl font-bold text-dark-50 mb-4">404</h1>
          <h2 className="text-2xl sm:text-3xl font-semibold text-dark-400 mb-6">Page Not Found</h2>
          <p className="text-dark-500 text-lg mb-10 max-w-md mx-auto">
            Sorry, we couldn&apos;t find the page you&apos;re looking for. It might have been moved or doesn&apos;t exist.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/auth/login">
              <Button size="lg" className="gap-2 w-full sm:w-auto">
                <Home className="w-5 h-5" />
                Go to Discover
              </Button>
            </Link>
            <Link to="/">
              <Button variant="outline" size="lg" className="gap-2 w-full sm:w-auto">
                <Heart className="w-5 h-5" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </PageContainer>
    </div>
  )
}