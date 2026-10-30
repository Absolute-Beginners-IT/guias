import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { configDefaults, defineConfig } from 'vitest/config'
import packageJson from './package.json'

export default defineConfig({
  // Relative base so the built index.html works when opened from disk (file://).
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  plugins: [react(), viteSingleFile()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Worktrees of parallel sessions live under .claude/ and would run their copy of every test.
    exclude: [...configDefaults.exclude, '.claude/**'],
    // The on-disk module cache does not notice YAML files added to the content glob,
    // which would let the integrity test pass against a stale catalog.
    fsModuleCache: false,
  },
})
