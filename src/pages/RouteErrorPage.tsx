import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Home } from 'lucide-react'
import { Button, PageContainer } from '../components/ui'

/**
 * Renders inside the router when a route module throws while loading, or when a
 * loader/action returns an error response. It is intentionally dependency-free
 * so it can still render when the rest of the app is broken.
 */
export function RouteErrorPage() {
  const error = useRouteError()

  let title = 'Something went wrong'
  let detail =
    'An unexpected error stopped this page from loading. Nothing was changed or saved.'

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      title = 'Page not found'
      detail = `We could not find ${error.status} ${error.statusText || 'this address'}.`
    } else {
      title = `Request failed (${error.status})`
      detail =
        typeof error.data === 'string' && error.data.length > 0
          ? error.data
          : 'The server could not complete this request.'
    }
  } else if (error instanceof Error && error.message) {
    detail = error.message
  }

  return (
    <PageContainer variant="narrow" padding="lg" className="py-20">
      <div className="text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-950 text-primary-400 ring-1 ring-primary-900">
          <AlertTriangle className="h-8 w-8" aria-hidden="true" />
        </div>

        <h1 className="mt-6 font-display text-3xl font-bold text-dark-50 sm:text-4xl">
          {title}
        </h1>
        <p className="mx-auto mt-3 max-w-prose text-dark-300">{detail}</p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Go back
          </Button>
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-dark-700 px-6 py-3 text-base font-medium text-dark-100 transition-colors hover:bg-dark-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <Home className="h-4 w-4" aria-hidden="true" />
            Back to home
          </Link>
        </div>
      </div>
    </PageContainer>
  )
}
