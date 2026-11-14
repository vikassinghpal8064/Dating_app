/**
 * The absolute origin the app is served from.
 *
 * Used to build email-redirect and OAuth callback URLs. `VITE_APP_URL` lets a
 * deployment pin the origin (a preview server, a CDN in front); otherwise the
 * browser's own origin is correct. The returned value is always an origin,
 * never a path, so callers append a route with a leading slash.
 */
export function getAppOrigin(): string {
  return import.meta.env.VITE_APP_URL || window.location.origin
}