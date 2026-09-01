import { execSync } from 'node:child_process'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const BUILD_SHA_PLACEHOLDER = '__BUILD_SHA__'

function readBuildSha(): string {
  try {
    const sha = execSync('git rev-parse --short HEAD', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    return sha.length > 0 ? sha : 'unknown'
  } catch {
    return 'unknown'
  }
}

const buildSha = readBuildSha()

// https://vite.dev/config/
export default defineConfig({
  base: '/pokemon/',
  define: {
    [BUILD_SHA_PLACEHOLDER]: JSON.stringify(buildSha),
  },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'html-build-sha',
      transformIndexHtml(html) {
        return html.replaceAll(BUILD_SHA_PLACEHOLDER, buildSha)
      },
    },
  ],
  test: {
    environment: 'jsdom',
  },
})
