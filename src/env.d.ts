/// <reference types="vite/client" />

/** Version from package.json, injected at build time by vite.config.ts. */
declare const __APP_VERSION__: string

interface ImportMetaEnv {
  /**
   * Navigation of the website that embeds the manual, as JSON: [{ "label", "href", "current"? }, ...].
   * When missing or invalid, no website bar is shown (the standalone file).
   */
  readonly VITE_SITE_NAV?: string
}
