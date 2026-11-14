import { createBrowserRouter } from 'react-router-dom'
import { MainLayout, AuthLayout, PublicLayout } from '../components/layout'
import { LandingPage } from '../pages/LandingPage'
import { AdminRoute, GuestRoute, ProtectedRoute } from './guards'
import { lazyPage } from './lazyPage'

/*
 * Every page module uses a *named* export, so each route goes through
 * `lazyPage()` rather than a bare `React.lazy()`.
 */
const LoginPage = lazyPage(() => import('../pages/auth/LoginPage'), 'LoginPage')
const SignUpPage = lazyPage(() => import('../pages/auth/SignUpPage'), 'SignUpPage')
const ForgotPasswordPage = lazyPage(
  () => import('../pages/auth/ForgotPasswordPage'),
  'ForgotPasswordPage'
)
const ResetPasswordPage = lazyPage(
  () => import('../pages/auth/ResetPasswordPage'),
  'ResetPasswordPage'
)
const VerifyEmailPage = lazyPage(
  () => import('../pages/auth/VerifyEmailPage'),
  'VerifyEmailPage'
)
const AuthCallbackPage = lazyPage(
  () => import('../pages/auth/AuthCallbackPage'),
  'AuthCallbackPage'
)

const AboutPage = lazyPage(() => import('../pages/public/AboutPage'), 'AboutPage')
const SafetyPage = lazyPage(() => import('../pages/public/SafetyPage'), 'SafetyPage')
const PrivacyPage = lazyPage(() => import('../pages/public/PrivacyPage'), 'PrivacyPage')
const TermsPage = lazyPage(() => import('../pages/public/TermsPage'), 'TermsPage')
const ContactPage = lazyPage(() => import('../pages/public/ContactPage'), 'ContactPage')

const OnboardingPage = lazyPage(
  () => import('../pages/app/OnboardingPage'),
  'OnboardingPage'
)
const DiscoverPage = lazyPage(() => import('../pages/app/DiscoverPage'), 'DiscoverPage')
const SearchPage = lazyPage(() => import('../pages/app/SearchPage'), 'SearchPage')
const ProfilePage = lazyPage(() => import('../pages/app/ProfilePage'), 'ProfilePage')
const MatchesPage = lazyPage(() => import('../pages/app/MatchesPage'), 'MatchesPage')
const MessagesPage = lazyPage(() => import('../pages/app/MessagesPage'), 'MessagesPage')
const ChatPage = lazyPage(() => import('../pages/app/ChatPage'), 'ChatPage')
const LikesPage = lazyPage(() => import('../pages/app/LikesPage'), 'LikesPage')
const MePage = lazyPage(() => import('../pages/app/MePage'), 'MePage')
const EditProfilePage = lazyPage(() => import('../pages/app/EditProfilePage'), 'EditProfilePage')
const SettingsPage = lazyPage(() => import('../pages/app/SettingsPage'), 'SettingsPage')
const BlockedUsersPage = lazyPage(() => import('../pages/settings/BlockedUsers'), 'BlockedUsersPage')
const VerifyProfilePage = lazyPage(() => import('../pages/app/VerifyProfilePage'), 'VerifyProfilePage')

const AdminPage = lazyPage(() => import('../pages/admin/AdminPage'), 'AdminPage')
const NotFoundPage = lazyPage(() => import('../pages/NotFoundPage'), 'NotFoundPage')
const RouteErrorPage = lazyPage(() => import('../pages/RouteErrorPage'), 'RouteErrorPage')

const publicRoutes = [
  { path: '/', element: <LandingPage /> },
  { path: '/about', element: <AboutPage /> },
  { path: '/safety', element: <SafetyPage /> },
  { path: '/privacy', element: <PrivacyPage /> },
  { path: '/terms', element: <TermsPage /> },
  { path: '/contact', element: <ContactPage /> },
]

export const router = createBrowserRouter([
  /* Marketing + legal pages share the public header and footer. */
  {
    element: <PublicLayout />,
    errorElement: <RouteErrorPage />,
    children: publicRoutes,
  },

  /* Auth screens. Signed-in users are redirected to Discover. */
  {
    path: '/auth',
    element: <GuestRoute />,
    errorElement: <RouteErrorPage />,
    children: [
      { element: <AuthLayout />, children: [
        { index: true, element: <LoginPage /> },
        { path: 'login', element: <LoginPage /> },
        { path: 'signup', element: <SignUpPage /> },
        { path: 'forgot-password', element: <ForgotPasswordPage /> },
      ] },
    ],
  },

  /* Callback screens sit outside `GuestRoute` on purpose: both establish a
     session, so a signed-in visitor has to be allowed to land here and see the
     result rather than being bounced back to Discover. */
  {
    path: '/auth/verify-email',
    element: <AuthLayout />,
    errorElement: <RouteErrorPage />,
    children: [{ index: true, element: <VerifyEmailPage /> }],
  },
  {
    path: '/auth/callback',
    element: <AuthLayout />,
    errorElement: <RouteErrorPage />,
    children: [{ index: true, element: <AuthCallbackPage /> }],
  },
  {
    path: '/auth/reset-password',
    element: <AuthLayout />,
    errorElement: <RouteErrorPage />,
    children: [{ index: true, element: <ResetPasswordPage /> }],
  },

  /* Onboarding is a full-screen flow outside the app chrome. */
  {
    path: '/onboarding',
    element: <ProtectedRoute />,
    errorElement: <RouteErrorPage />,
    children: [{ index: true, element: <OnboardingPage /> }],
  },

  /* The signed-in application. */
  {
    path: '/app',
    element: <ProtectedRoute />,
    errorElement: <RouteErrorPage />,
    children: [
      { element: <MainLayout />, children: [
        { index: true, element: <DiscoverPage /> },
        { path: 'discover', element: <DiscoverPage /> },
        { path: 'search', element: <SearchPage /> },
        { path: 'matches', element: <MatchesPage /> },
        { path: 'messages', element: <MessagesPage /> },
        { path: 'messages/:matchId', element: <ChatPage /> },
        { path: 'likes', element: <LikesPage /> },
        { path: 'me', element: <MePage /> },
        { path: 'me/edit', element: <EditProfilePage /> },
        { path: 'verify', element: <VerifyProfilePage /> },
        { path: 'settings', element: <SettingsPage /> },
        { path: 'settings/blocked', element: <BlockedUsersPage /> },
        { path: 'profile/:id', element: <ProfilePage /> },
      ] },
    ],
  },

  /* Moderation console. */
  {
    path: '/admin',
    element: <AdminRoute />,
    errorElement: <RouteErrorPage />,
    children: [{ element: <MainLayout />, children: [{ index: true, element: <AdminPage /> }] }],
  },

  /* Unknown URLs. */
  {
    element: <PublicLayout />,
    children: [{ path: '*', element: <NotFoundPage /> }],
  },
])
