/// <reference types="vite/client" />

/** Version from package.json, injected at build time by vite.config.ts. */
declare const __APP_VERSION__: string

interface ImportMetaEnv {
  /** Address of the website that embeds the manual; when empty, no "back to the website" link is shown. */
  readonly VITE_HOME_URL?: string
}
