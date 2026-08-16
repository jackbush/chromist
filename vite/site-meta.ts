import type { HtmlTagDescriptor, Plugin } from 'vite'
import { site } from '../site.config'

/**
 * Expands site.config.ts into the head tags and the web app manifest, so the
 * metadata exists in exactly one place. index.html carries no titles, icons or
 * descriptions of its own.
 */

const MANIFEST_FILE = 'manifest.webmanifest'

export function siteMeta(): Plugin {
  // Base path ('/chromist/' here), known only once Vite has resolved config.
  let base = '/'
  /** Site-root-relative asset path -> URL the browser can request. */
  const asset = (path: string) => base + path
  /** Site-root-relative asset path -> absolute URL, as scrapers require. */
  const absolute = (path: string) => site.url + path

  return {
    name: 'site-meta',

    configResolved(config) {
      base = config.base
    },

    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return {
          // <html lang> is metadata too, and index.html no longer owns it.
          html: html.replace(
            /<html(\s[^>]*)?\slang="[^"]*"/,
            (match) => match.replace(/lang="[^"]*"/, `lang="${site.lang}"`),
          ),
          tags: headTags(asset, absolute),
        }
      },
    },

    // Dev has no bundle to emit into, so serve the manifest from memory.
    configureServer(server) {
      server.middlewares.use(asset(MANIFEST_FILE), (_req, res) => {
        res.setHeader('Content-Type', 'application/manifest+json')
        res.end(webManifest(asset))
      })
    },

    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: MANIFEST_FILE,
        source: webManifest(asset),
      })
    },
  }
}

type Url = (path: string) => string

function headTags(asset: Url, absolute: Url): HtmlTagDescriptor[] {
  const { cover, icons, twitter, themeColor } = site
  const canonical = site.url
  const coverUrl = absolute(cover.src)

  const meta = (
    attr: 'name' | 'property',
    key: string,
    content: string | number,
  ): HtmlTagDescriptor => ({
    tag: 'meta',
    attrs: { [attr]: key, content: String(content) },
    injectTo: 'head',
  })

  return [
    { tag: 'title', children: site.title, injectTo: 'head' },
    meta('name', 'description', site.description),
    meta('name', 'application-name', site.name),
    meta('name', 'apple-mobile-web-app-title', site.shortName),
    { tag: 'link', attrs: { rel: 'canonical', href: canonical }, injectTo: 'head' },

    // A single theme-color would be wrong in one scheme or the other.
    {
      tag: 'meta',
      attrs: {
        name: 'theme-color',
        media: '(prefers-color-scheme: light)',
        content: themeColor.light,
      },
      injectTo: 'head',
    },
    {
      tag: 'meta',
      attrs: {
        name: 'theme-color',
        media: '(prefers-color-scheme: dark)',
        content: themeColor.dark,
      },
      injectTo: 'head',
    },

    {
      tag: 'link',
      attrs: { rel: 'icon', href: asset(icons.svg), type: 'image/svg+xml' },
      injectTo: 'head',
    },
    {
      tag: 'link',
      attrs: { rel: 'apple-touch-icon', href: asset(icons.appleTouch) },
      injectTo: 'head',
    },
    {
      tag: 'link',
      attrs: { rel: 'manifest', href: asset(MANIFEST_FILE) },
      injectTo: 'head',
    },

    meta('property', 'og:type', 'website'),
    meta('property', 'og:site_name', site.name),
    meta('property', 'og:title', site.title),
    meta('property', 'og:description', site.description),
    meta('property', 'og:url', canonical),
    meta('property', 'og:locale', site.lang.replace('-', '_')),
    meta('property', 'og:image', coverUrl),
    meta('property', 'og:image:type', cover.type),
    meta('property', 'og:image:width', cover.width),
    meta('property', 'og:image:height', cover.height),
    meta('property', 'og:image:alt', cover.alt),

    meta('name', 'twitter:card', twitter.card),
    ...(twitter.site ? [meta('name', 'twitter:site', twitter.site)] : []),
    ...(twitter.creator ? [meta('name', 'twitter:creator', twitter.creator)] : []),
    meta('name', 'twitter:title', site.title),
    meta('name', 'twitter:description', site.description),
    meta('name', 'twitter:image', coverUrl),
    meta('name', 'twitter:image:alt', cover.alt),
  ]
}

function webManifest(asset: Url): string {
  const { manifest, icons } = site
  return `${JSON.stringify(
    {
      // The base path is the app: identity, launch URL and scope alike.
      id: asset(''),
      name: site.name,
      short_name: site.shortName,
      description: site.description,
      start_url: asset(''),
      scope: asset(''),
      display: manifest.display,
      orientation: manifest.orientation,
      background_color: manifest.backgroundColor,
      theme_color: site.themeColor.light,
      lang: site.lang,
      categories: manifest.categories,
      icons: icons.manifest.map((icon) => ({ ...icon, src: asset(icon.src) })),
    },
    null,
    2,
  )}\n`
}
