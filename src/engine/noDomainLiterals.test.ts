/**
 * Architectural guard: engine and lib renderers stay data-driven.
 * Domain names live in src/data/. Mechanic numerics live on the ruleset.
 * Neither may appear as literals in production engine or src/lib/ prose.
 */
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
const ENGINE_DIR = join(ROOT, 'src/engine')
const LIB_DIR = join(ROOT, 'src/lib')
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

/**
 * Number-words for ruleset-backed counts and percents. 0 / 1 / 2 are omitted
 * — they collide with Hyper Training's IV 0, hatchLevel 1 as a bare word,
 * and "two held-item slots" / "one specific stat".
 */
const NUMBER_WORDS: Record<number, string> = {
  3: 'three',
  5: 'five',
  50: 'fifty',
  60: 'sixty',
  80: 'eighty',
}

/**
 * Counts that are not ruleset fields. The scan reads string/template
 * literals only, so code-only values cannot match; they are listed so a
 * later tightening does not treat them as mechanic rates.
 *
 * - two held-item slots / one per parent: two parents, one item each —
 *   hardware of the pair, not ivInheritance counts.
 * - one specific stat / one specific parent IV: a power item always locks
 *   a single IV; that 1 is not destinyKnotBoostedCount.
 * - Hyper Training's 0: a target IV value Hyper Training cannot produce,
 *   not hatchLevel or an ability/shiny rate.
 * - passer preview cap of 3: `passers.length <= 3` truncates the concrete-
 *   passer list; it is not baseCountInherited.
 * - 0.5 gender-naming cutoff: `namedGender` names an allocation gender
 *   only when the easiest catalogued ratio is strictly below half; it is
 *   not everstone passOdds.
 */
const EXEMPT_NUMERIC_SPANS: Array<{ pattern: RegExp; why: string }> = [
  {
    pattern: /two held-item slots exist \(one per parent\)/i,
    why: 'Two parents, one item each — not ivInheritance counts.',
  },
  {
    pattern: /one specific (?:parent IV|stat)/i,
    why: 'A power item always locks one IV; not destinyKnotBoostedCount.',
  },
  {
    pattern: /produce a 0|already has 0 in that stat/i,
    why: 'Hyper Training cannot create an IV of 0; that 0 is a target value, not hatchLevel or odds.',
  },
]

type Violation = {
  file: string
  line: number
  literal: string
  inString: string
}

type NumericForm = {
  form: string
  pattern: RegExp
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

function isProductionSource(name: string): boolean {
  if (name.endsWith('.test.ts') || name.endsWith('.test.tsx')) return false
  return name.endsWith('.ts') || name.endsWith('.tsx')
}

function productionSourceFiles(): string[] {
  return [
    ...walkFiles(ENGINE_DIR, isProductionSource),
    ...walkFiles(LIB_DIR, isProductionSource),
  ]
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

function wordPattern(word: string): RegExp {
  return new RegExp(
    `(^|[^A-Za-z0-9_])${escapeRegExp(word)}([^A-Za-z0-9_]|$)`,
    'i',
  )
}

function percentPattern(pct: number): RegExp {
  return new RegExp(`(^|[^0-9])${pct}%`)
}

function addForm(forms: Map<string, NumericForm>, form: string, pattern: RegExp) {
  if (!forms.has(form)) forms.set(form, { form, pattern })
}

function addPercent(forms: Map<string, NumericForm>, odds: number) {
  if (!Number.isFinite(odds)) return
  const pct = Math.round(odds * 100)
  addForm(forms, `${pct}%`, percentPattern(pct))
  const word = NUMBER_WORDS[pct]
  if (word) addForm(forms, word, wordPattern(word))
}

function addIntegerCount(forms: Map<string, NumericForm>, n: number) {
  if (!Number.isInteger(n)) return
  const word = NUMBER_WORDS[n]
  if (word) addForm(forms, word, wordPattern(word))
  addForm(
    forms,
    `${n} IVs`,
    new RegExp(`(^|[^0-9])${n} IVs?(?![A-Za-z])`, 'i'),
  )
}

function addHatchLevel(forms: Map<string, NumericForm>, n: number) {
  if (!Number.isInteger(n)) return
  addForm(forms, `level ${n}`, new RegExp(`level ${n}(?![0-9])`, 'i'))
  const word = NUMBER_WORDS[n]
  if (word) {
    addForm(forms, `level ${word}`, new RegExp(`level ${word}(?![A-Za-z])`, 'i'))
  }
}

function addShinyTier(forms: Map<string, NumericForm>, value: unknown) {
  if (!value || typeof value !== 'object') return
  const odds = (value as Record<string, unknown>).odds
  if (typeof odds === 'string' && /^\d+\/\d+$/.test(odds)) {
    addForm(forms, odds, new RegExp(escapeRegExp(odds)))
  }
}

function addPassOdds(forms: Map<string, NumericForm>, value: unknown) {
  if (!value || typeof value !== 'object') return
  const passOdds = (value as Record<string, unknown>).passOdds
  if (typeof passOdds === 'number') addPercent(forms, passOdds)
}

/**
 * Ruleset-backed mechanic numerics, including percent and number-word
 * renderings. Shipped rulesets currently omit everstone-chance passOdds
 * (none / guaranteed), but a 50% renderer literal is exactly that field's
 * historical hardcode — always include it.
 */
function collectMechanicNumericForms(dataDir: string): NumericForm[] {
  const forms = new Map<string, NumericForm>()
  addPercent(forms, 0.5)

  for (const file of walkFiles(dataDir, (name) => name.endsWith('.json'))) {
    const data = readJson(file)
    if (!data || typeof data !== 'object' || Array.isArray(data)) continue
    const record = data as Record<string, unknown>

    addPassOdds(forms, record.natureLock)

    const ability = record.abilityInheritance
    if (ability && typeof ability === 'object') {
      const ab = ability as Record<string, unknown>
      if (typeof ab.standardOdds === 'number') addPercent(forms, ab.standardOdds)
      if (typeof ab.hiddenOdds === 'number') addPercent(forms, ab.hiddenOdds)
    }

    const iv = record.ivInheritance
    if (iv && typeof iv === 'object') {
      const ivs = iv as Record<string, unknown>
      if (typeof ivs.baseCountInherited === 'number') {
        addIntegerCount(forms, ivs.baseCountInherited)
      }
      if (typeof ivs.destinyKnotBoostedCount === 'number') {
        addIntegerCount(forms, ivs.destinyKnotBoostedCount)
      }
      if (
        typeof ivs.baseCountInherited === 'number' &&
        typeof ivs.destinyKnotBoostedCount === 'number'
      ) {
        const from = ivs.baseCountInherited
        const to = ivs.destinyKnotBoostedCount
        addForm(
          forms,
          `from ${from} to ${to}`,
          new RegExp(`from ${from} to ${to}(?![0-9])`),
        )
      }
    }

    if (typeof record.hatchLevel === 'number') {
      addHatchLevel(forms, record.hatchLevel)
    }

    addShinyTier(forms, record.baseShinyOdds)
    addShinyTier(forms, record.masudaMethod)
    addShinyTier(
      forms,
      record.shinyEggModifiers &&
        typeof record.shinyEggModifiers === 'object'
        ? (record.shinyEggModifiers as Record<string, unknown>).shinyCharmOdds
        : undefined,
    )
    addShinyTier(
      forms,
      record.shinyEggModifiers &&
        typeof record.shinyEggModifiers === 'object'
        ? (record.shinyEggModifiers as Record<string, unknown>)
            .masudaPlusCharmOdds
        : undefined,
    )
  }

  return [...forms.values()]
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

function clip(value: string): string {
  return value.length > 80 ? `${value.slice(0, 77)}...` : value
}

function findNameViolationsInSource(
  rel: string,
  source: string,
  forbidden: Set<string>,
): Violation[] {
  const sortedNames = [...forbidden].sort((a, b) => b.length - a.length)
  const violations: Violation[] = []
  for (const { line, value } of extractStringLiterals(source)) {
    if (ALLOWED_LITERALS.has(value)) continue
    for (const name of sortedNames) {
      if (ALLOWED_LITERALS.has(name)) continue
      if (!containsDomainName(value, name)) continue
      violations.push({
        file: rel,
        line,
        literal: name,
        inString: clip(value),
      })
      break
    }
  }
  return violations
}

function findNameViolations(
  files: string[],
  forbidden: Set<string>,
): Violation[] {
  const violations: Violation[] = []
  for (const file of files) {
    violations.push(
      ...findNameViolationsInSource(
        relative(ROOT, file),
        readFileSync(file, 'utf8'),
        forbidden,
      ),
    )
  }
  return violations
}

function exemptSpans(value: string): Array<[number, number]> {
  const spans: Array<[number, number]> = []
  for (const { pattern } of EXEMPT_NUMERIC_SPANS) {
    const global = new RegExp(
      pattern.source,
      pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`,
    )
    let match = global.exec(value)
    while (match) {
      spans.push([match.index, match.index + match[0].length])
      match = global.exec(value)
    }
  }
  return spans
}

function spanCovers(
  index: number,
  length: number,
  spans: Array<[number, number]>,
): boolean {
  const end = index + length
  return spans.some(([start, stop]) => index >= start && end <= stop)
}

function findNumericViolationsInSource(
  rel: string,
  source: string,
  forms: NumericForm[],
): Violation[] {
  const violations: Violation[] = []
  for (const { line, value } of extractStringLiterals(source)) {
    const spans = exemptSpans(value)
    for (const { form, pattern } of forms) {
      const match = pattern.exec(value)
      if (!match) continue
      if (spanCovers(match.index, match[0].length, spans)) continue
      violations.push({
        file: rel,
        line,
        literal: form,
        inString: clip(value),
      })
      break
    }
  }
  return violations
}

function findNumericViolations(
  files: string[],
  forms: NumericForm[],
): Violation[] {
  const violations: Violation[] = []
  for (const file of files) {
    violations.push(
      ...findNumericViolationsInSource(
        relative(ROOT, file),
        readFileSync(file, 'utf8'),
        forms,
      ),
    )
  }
  return violations
}

function gitShow(spec: string): string {
  return execFileSync('git', ['show', spec], {
    encoding: 'utf8',
    cwd: ROOT,
  })
}

function reportViolations(header: string, violations: Violation[]): void {
  if (violations.length === 0) return
  const report = violations
    .map(
      (v) =>
        `${v.file}:${v.line} — forbidden literal ${JSON.stringify(v.literal)} in ${JSON.stringify(v.inString)}`,
    )
    .join('\n')
  expect.fail(`${header}\n${report}`)
}

describe('architecture: no domain literals', () => {
  it('engine and lib production source contain no catalog name literals', () => {
    const forbidden = collectDomainNames(DATA_DIR)
    expect(forbidden.size).toBeGreaterThan(0)

    const files = productionSourceFiles()
    const libFiles = files.filter((file) =>
      relative(ROOT, file).startsWith(`src/lib/`),
    )
    expect(files.length).toBeGreaterThan(0)
    expect(libFiles.length).toBeGreaterThan(0)
    expect(
      libFiles.some((file) => file.endsWith(`${join('lib', 'reason.ts')}`)),
    ).toBe(true)

    reportViolations(
      'Engine and lib renderers must not hard-code domain names from data.',
      findNameViolations(files, forbidden),
    )
  })

  it('flags a catalog name hardcoded in a lib renderer', () => {
    const forbidden = collectDomainNames(DATA_DIR)
    expect(forbidden.has('Charmander')).toBe(true)
    const source = [
      'export function formatHatchOutcome() {',
      '  return `Eggs hatch as Charmander at level ${ruleset.hatchLevel}.`',
      '}',
    ].join('\n')
    const violations = findNameViolationsInSource(
      'src/lib/hatchOutcome.ts',
      source,
      forbidden,
    )
    expect(violations).toEqual([
      expect.objectContaining({
        file: 'src/lib/hatchOutcome.ts',
        literal: 'Charmander',
      }),
    ])
  })
})

describe('architecture: no ruleset numeric literals in prose', () => {
  it('engine and lib production prose contain no ruleset-backed mechanic numerics', () => {
    const forms = collectMechanicNumericForms(DATA_DIR)
    expect(forms.some((entry) => entry.form === '50%')).toBe(true)
    expect(forms.some((entry) => entry.form === 'five')).toBe(true)

    const files = productionSourceFiles()
    reportViolations(
      'Engine and lib renderers must interpolate ruleset mechanic numerics.',
      findNumericViolations(files, forms),
    )
  })

  it("flags 6155387's parent's hardcoded 50% everstone chance", () => {
    const forms = collectMechanicNumericForms(DATA_DIR)
    const source = gitShow('6155387^:src/lib/reason.ts')
    const violations = findNumericViolationsInSource(
      'src/lib/reason.ts',
      source,
      forms,
    )
    expect(violations.some((entry) => entry.literal === '50%')).toBe(true)
  })

  it('flags the pre-860de95 hardcoded five IVs', () => {
    const forms = collectMechanicNumericForms(DATA_DIR)
    const source = gitShow('6155387:src/lib/reason.ts')
    const violations = findNumericViolationsInSource(
      'src/lib/reason.ts',
      source,
      forms,
    )
    expect(violations.some((entry) => entry.literal === 'five')).toBe(true)
  })
})
