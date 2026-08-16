/**
 * Single source of truth for everything that names, describes or illustrates
 * the site: <title>, meta description, canonical URL, Open Graph, Twitter,
 * icons, theme colour and the web app manifest.
 *
 * Nothing here is duplicated in index.html — the siteMeta() Vite plugin
 * (vite/site-meta.ts) derives every tag and the manifest from this object, and
 * the app imports it for on-screen text. Edit here, and only here.
 *
 * Asset paths are relative to the site root (no leading slash) so they survive
 * the `/chromist/` base path; the plugin prefixes them.
 */

export type SiteConfig = typeof site

export const site = {
  /** Product name: window heading, og:site_name, manifest name. */
  name: 'Chromist',
  /** Document <title>. */
  title: 'Chromist',
  /** Home screen / app launcher label. Keep it under ~12 characters. */
  shortName: 'Chromist',
  /** Meta description, og:description, twitter:description, manifest. */
  description:
    'Get your colours right: build or import palettes, audit accessibility and share easily. Supports P3 colours and future accessibility standards.',
  /** Canonical origin + base path. Trailing slash required. */
  url: 'https://jackbush.github.io/chromist/',
  /** <html lang> and, in Open Graph's underscored form, og:locale. */
  lang: 'en-GB',

  /**
   * Browser UI colour per scheme. The app paints its own background these
   * match: --bg is #000 in dark, #fff in light (src/styles.css).
   */
  themeColor: {
    light: '#ffffff',
    dark: '#000000',
  },

  icons: {
    /** Scalable favicon — the only one modern browsers need. */
    svg: 'favicon.svg',
    /** iOS home screen. 180×180 PNG. */
    appleTouch: 'apple-touch-icon.png',
    /** Manifest icons: raster sizes Android needs for install prompts. */
    manifest: [
      { src: 'apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  },

  /** Link preview image. PNG, because several scrapers still refuse SVG. */
  cover: {
    src: 'cover.png',
    width: 1200,
    height: 630,
    type: 'image/png',
    alt: 'Chromist — a palette of colour swatches beside their contrast scores.',
  },

  twitter: {
    card: 'summary_large_image',
    /** @handles, or '' to omit the tag. */
    site: '',
    creator: '',
  },

  manifest: {
    display: 'standalone' as const,
    orientation: 'any' as const,
    /** Splash screen behind the icon while the app boots. */
    backgroundColor: '#ffffff',
    categories: ['design', 'productivity', 'developer'],
  },
}
