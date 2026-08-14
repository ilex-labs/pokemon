/**
 * Architectural guard: engine source must stay data-driven.
 * Domain names live in src/data/ — never as string literals in src/engine/.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
const ENGINE_DIR = join(ROOT, 'src/engine')
const DATA_DIR = join(ROOT, 'src/data')

/**
 * Generational mechanic names the ruleset drives, plus Ditto (mechanic-level
 * via ditto.available). Everything else from data is forbidden in engine source.
 */
const ALLOWED_LITERALS = new Set([
  'Ditto',
  'Everstone',
  'Destiny Knot',
  'Ability Patch',
  'Ability Capsule',
  'a power item',
])

type Violation = {
  file: string
  line: number
  literal: string
  inString: string
}

function walkFiles(dir: string, predicate: (name: string) => boolean): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...walkFiles(full, predicate))
    } else if (predicate(entry)) {
      out.push(full)
    }
  }
  return out
}

function readJson(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, 'utf8'))
}

function addName(set: Set<string>, value: unknown) {
  if (typeof value === 'string' && value.trim().length > 0) {
    set.add(value)
  }
}

/** Species, abilities, moves, and game IDs from every data JSON file. */
function collectDomainNames(dataDir: string): Set<string> {
  const names = new Set<string>()

  for (const file of walkFiles(dataDir, (name) => name.endsWith('.json'))) {
    const data = readJson(file)
    if (!data || typeof data !== 'object') continue
    const record = data as Record<string, unknown>

    addName(names, record.id)

    const species = record.species
    if (species && typeof species === 'object') {
      for (const [speciesName, entry] of Object.entries(
        species as Record<string, unknown>,
      )) {
        addName(names, speciesName)
        if (!entry || typeof entry !== 'object') continue
        const spec = entry as Record<string, unknown>
        addName(names, spec.hatchesInto)
        addName(names, spec.babyWithIncense)
        const abilities = spec.abilities
        if (abilities && typeof abilities === 'object') {
          const ab = abilities as Record<string, unknown>
          if (Array.isArray(ab.standard)) {
            for (const ability of ab.standard) addName(names, ability)
          }
          addName(names, ab.hidden)
        }
      }
    }

    const eggGroups = record.eggGroups
    if (eggGroups && typeof eggGroups === 'object') {
      for (const members of Object.values(eggGroups as Record<string, unknown>)) {
        if (!Array.isArray(members)) continue
        for (const member of members) addName(names, member)
      }
    }

    const eggMoves = record.eggMoves
    if (eggMoves && typeof eggMoves === 'object') {
      for (const [speciesName, entries] of Object.entries(
        eggMoves as Record<string, unknown>,
      )) {
        addName(names, speciesName)
        if (!Array.isArray(entries)) continue
        for (const entry of entries) {
          if (!entry || typeof entry !== 'object') continue
          const moveEntry = entry as Record<string, unknown>
          addName(names, moveEntry.move)
          if (Array.isArray(moveEntry.parentSpecies)) {
            for (const parent of moveEntry.parentSpecies) addName(names, parent)
          }
        }
      }
    }

    for (const key of ['abilityDescriptions', 'moveDescriptions'] as const) {
      const catalog = record[key]
      if (catalog && typeof catalog === 'object') {
        for (const name of Object.keys(catalog as Record<string, unknown>)) {
          addName(names, name)
        }
      }
    }
  }

  // Allowed mechanics may also appear in data prose — never treat them as violations.
  for (const allowed of ALLOWED_LITERALS) {
    names.delete(allowed)
  }

  return names
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** True when `name` appears as its own token / phrase inside `haystack`. */
function containsDomainName(haystack: string, name: string): boolean {
  if (name.includes(' ') || name.includes('-') || name.includes('/')) {
    return haystack.includes(name)
  }
  const pattern = new RegExp(
    `(^|[^A-Za-z0-9_])${escapeRegExp(name)}([^A-Za-z0-9_]|$)`,
  )
  return pattern.test(haystack)
}

/**
 * Scan TypeScript source for string / template literals, skipping comments.
 * Reports the line of the opening quote and the decoded literal text.
 */
function extractStringLiterals(
  source: string,
): Array<{ line: number; value: string }> {
  const results: Array<{ line: number; value: string }> = []
  let i = 0
  let line = 1

  const advance = () => {
    if (source[i] === '\n') line += 1
    i += 1
  }

  while (i < source.length) {
    const ch = source[i]!
    const next = source[i + 1]

    // Line comment
    if (ch === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') advance()
      continue
    }

    // Block comment
    if (ch === '/' && next === '*') {
      advance()
      advance()
      while (i < source.length) {
        if (source[i] === '*' && source[i + 1] === '/') {
          advance()
          advance()
          break
        }
        advance()
      }
      continue
    }

    // Single- or double-quoted string
    if (ch === "'" || ch === '"') {
      const quote = ch
      const startLine = line
      advance()
      let value = ''
      while (i < source.length) {
        const c = source[i]!
        if (c === '\\') {
          advance()
          if (i < source.length) {
            value += source[i]
            advance()
          }
          continue
        }
        if (c === quote) {
          advance()
          break
        }
        value += c
        advance()
      }
      results.push({ line: startLine, value })
      continue
    }

    // Template literal — only static ones (no ${...}) are checked as a unit;
    // interpolated templates are walked for static chunks between expressions.
    if (ch === '`') {
      const startLine = line
      advance()
      let value = ''
      let staticOnly = true
      while (i < source.length) {
        const c = source[i]!
        if (c === '\\') {
          advance()
          if (i < source.length) {
            value += source[i]
            advance()
          }
          continue
        }
        if (c === '`') {
          advance()
          break
        }
        if (c === '$' && source[i + 1] === '{') {
          staticOnly = false
          // Flush the static chunk before the expression.
          if (value.length > 0) {
            results.push({ line: startLine, value })
            value = ''
          }
          advance()
          advance()
          let depth = 1
          while (i < source.length && depth > 0) {
            const inner = source[i]!
            if (inner === "'" || inner === '"' || inner === '`') {
              // Nested string inside ${} — recurse by continuing outer scan
              // would be complex; skip nested quotes simply.
              const q = inner
              advance()
              while (i < source.length) {
                const n = source[i]!
                if (n === '\\') {
                  advance()
                  advance()
                  continue
                }
                if (n === q) {
                  advance()
                  break
                }
                advance()
              }
              continue
            }
            if (inner === '{') depth += 1
            if (inner === '}') depth -= 1
            advance()
          }
          continue
        }
        value += c
        advance()
      }
      if (value.length > 0 || staticOnly) {
        results.push({ line: startLine, value })
      }
      continue
    }

    advance()
  }

  return results
}

function findViolations(
  engineFiles: string[],
  forbidden: Set<string>,
): Violation[] {
  const sortedNames = [...forbidden].sort((a, b) => b.length - a.length)
  const violations: Violation[] = []

  for (const file of engineFiles) {
    const source = readFileSync(file, 'utf8')
    const rel = relative(ROOT, file)
    for (const { line, value } of extractStringLiterals(source)) {
      if (ALLOWED_LITERALS.has(value)) continue
      for (const name of sortedNames) {
        if (ALLOWED_LITERALS.has(name)) continue
        if (!containsDomainName(value, name)) continue
        violations.push({
          file: rel,
          line,
          literal: name,
          inString: value.length > 80 ? `${value.slice(0, 77)}...` : value,
        })
        break
      }
    }
  }

  return violations
}

describe('engine architecture: no domain literals', () => {
  it('contains no species, ability, move, or game-id string literals from data', () => {
    const forbidden = collectDomainNames(DATA_DIR)
    expect(forbidden.size).toBeGreaterThan(0)

    const engineFiles = walkFiles(
      ENGINE_DIR,
      (name) => name.endsWith('.ts') && !name.endsWith('.test.ts'),
    )
    expect(engineFiles.length).toBeGreaterThan(0)

    const violations = findViolations(engineFiles, forbidden)
    if (violations.length > 0) {
      const report = violations
        .map(
          (v) =>
            `${v.file}:${v.line} — forbidden literal ${JSON.stringify(v.literal)} in ${JSON.stringify(v.inString)}`,
        )
        .join('\n')
      expect.fail(
        `Engine must not hard-code domain names from data.\n${report}`,
      )
    }
  })
})
