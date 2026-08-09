import fs from 'node:fs'
import path from 'node:path'

const COLORS = [
  'page',
  'surface',
  'raised',
  'edge',
  'muted',
  'body',
  'bright',
  'accent',
  'accent-hover',
  'on-accent',
  'verdigris',
  'brass',
  'oxide',
  'bismuth',
]

const assetsDir = path.join('dist', 'assets')
if (!fs.existsSync(assetsDir)) {
  console.error('assert-theme: dist/assets missing — run vite build first')
  process.exit(1)
}

const cssFile = fs.readdirSync(assetsDir).find((name) => name.endsWith('.css'))
if (!cssFile) {
  console.error('assert-theme: no CSS file in dist/assets')
  process.exit(1)
}

const css = fs.readFileSync(path.join(assetsDir, cssFile), 'utf8')
const missing = []

for (const color of COLORS) {
  const token = `--color-${color}:`
  const utility = `.text-${color}`
  if (!css.includes(token)) missing.push(`token ${token}`)
  if (!css.includes(utility)) missing.push(`utility ${utility}`)
}

if (missing.length > 0) {
  console.error('assert-theme: palette incomplete in built CSS:')
  for (const item of missing) console.error(`  - ${item}`)
  process.exit(1)
}

console.log(`assert-theme: ok (${COLORS.length} colours in ${cssFile})`)
