import { lazy } from 'react'
import type { ComponentType, LazyExoticComponent } from 'react'

/**
 * Route pages in this app use *named* exports (`export function DiscoverPage()`).
 * `React.lazy` only understands a module's `default` export, so a bare
 * `lazy(() => import('./X'))` resolves to `undefined` at runtime and React
 * throws "Unexpected Application Error!". This helper adapts a named export to
 * the shape `lazy` expects, and fails loudly if the export is ever renamed.
 */
export type PageComponent = ComponentType<Record<string, unknown>>

export function lazyPage<M extends Record<string, unknown>>(
  loader: () => Promise<M>,
  exportName: keyof M & string
): LazyExoticComponent<PageComponent> {
  return lazy(() =>
    loader().then((mod) => {
      const component = mod[exportName]
      if (component == null) {
        throw new Error(
          `Route module is missing the export "${exportName}". ` +
            'Page modules must keep their named export so lazyPage() can load them.'
        )
      }
      return { default: component as PageComponent }
    })
  )
}
