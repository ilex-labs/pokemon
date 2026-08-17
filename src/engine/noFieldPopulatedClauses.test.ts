/**
 * Architectural guard: step instructions must not append a clause because a
 * parent field happens to be set. Recitation belongs on ParentRequirement;
 * the UI already omits empty fields.
 *
 * Rule / availability conditions (eggMoveEligibleParents, lock.method,
 * destinyKnotAvailable, and similar flags) are allowed.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const ENGINE = join(dirname(fileURLToPath(import.meta.url)), 'daycareEngine.ts')

const STEP_BUILDERS = new Set([
  'buildBlockedPairStep',
  'buildIncenseStep',
  'buildAbilityBlockStep',
  'buildAbilityInheritStep',
  'buildEggMoveStepsForStrategy',
  'hyperTrainingAllMaxFlag',
  'itemConflictFromParents',
  'buildIvStep',
  'buildStepsForStrategy',
])

/** ParentRequirement fields whose presence the UI already renders. */
const PARENT_FIELDS = [
  'gender',
  'heldItem',
  'mustHaveNature',
  'mustHaveAbility',
  'mustKnow',
  'mustOriginateFromDifferentLanguage',
  'acquisition',
  'heldItemReason',
  'genderReason',
]

type Hit = {
  fn: string
  line: number
  text: string
}

function sliceTopLevelFunctions(
  source: string,
): Array<{ name: string; startLine: number; body: string }> {
  const starts: Array<{ name: string; index: number }> = []
  const re = /^function (\w+)\(/gm
  let match: RegExpExecArray | null
  while ((match = re.exec(source))) {
    starts.push({ name: match[1]!, index: match.index })
  }
  return starts.map((entry, index) => {
    const end = starts[index + 1]?.index ?? source.length
    return {
      name: entry.name,
      startLine: source.slice(0, entry.index).split('\n').length,
      body: source.slice(entry.index, end),
    }
  })
}

/**
 * `${x.gender ? ` (${x.gender})` : ''}` — truthiness ternary on a dotted
 * identifier, consequent is a template, alternate is empty.
 */
const EMPTY_ELSE_FIELD_TERNARY =
  /([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)+)\s*\?\s*`[\s\S]*?`\s*:\s*(?:''|"")/g

function isParentFieldAccess(expr: string): boolean {
  const field = expr.split('.').pop()
  return field != null && PARENT_FIELDS.includes(field)
}

function hasComparison(expr: string): boolean {
  return /===|!==|==|!=|<=|>=|<|>/.test(expr)
}

function findHits(
  fn: string,
  startLine: number,
  body: string,
): Hit[] {
  const hits: Hit[] = []
  const fieldAlt = PARENT_FIELDS.join('|')

  EMPTY_ELSE_FIELD_TERNARY.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = EMPTY_ELSE_FIELD_TERNARY.exec(body))) {
    const expr = match[1]!
    if (hasComparison(expr)) continue
    if (!expr.includes('.') || !isParentFieldAccess(expr)) continue
    const line = startLine + body.slice(0, match.index).split('\n').length - 1
    hits.push({
      fn,
      line,
      text: match[0].replace(/\s+/g, ' ').slice(0, 80),
    })
  }

  // `if (parent.gender)` / `if (parent.heldItem)` — populated, not compared.
  const ifPopulated = new RegExp(
    `if\\s*\\(\\s*[A-Za-z_]\\w*\\.(${fieldAlt})\\s*\\)`,
    'g',
  )
  while ((match = ifPopulated.exec(body))) {
    const line = startLine + body.slice(0, match.index).split('\n').length - 1
    hits.push({
      fn,
      line,
      text: match[0].replace(/\s+/g, ' '),
    })
  }

  // `parents.some((parent) => parent.heldItem)` as a populate-gate.
  const somePopulated = new RegExp(
    `\\.some\\(\\s*\\([^)]*\\)\\s*=>\\s*[A-Za-z_]\\w*\\.(${fieldAlt})\\s*\\)`,
    'g',
  )
  while ((match = somePopulated.exec(body))) {
    const line = startLine + body.slice(0, match.index).split('\n').length - 1
    hits.push({
      fn,
      line,
      text: match[0].replace(/\s+/g, ' '),
    })
  }

  return hits
}

describe('step builders: no field-populated clause-appending', () => {
  it('does not gate instruction clauses on whether a parent field is set', () => {
    const source = readFileSync(ENGINE, 'utf8')
    const builders = sliceTopLevelFunctions(source).filter((fn) =>
      STEP_BUILDERS.has(fn.name),
    )
    expect(builders.map((fn) => fn.name).sort()).toEqual(
      [...STEP_BUILDERS].sort(),
    )

    const hits = builders.flatMap((fn) =>
      findHits(fn.name, fn.startLine, fn.body),
    )
    if (hits.length > 0) {
      const report = hits
        .map((hit) => `${hit.fn}:${hit.line} — ${JSON.stringify(hit.text)}`)
        .join('\n')
      expect.fail(
        `Step builders must not append clauses because a ParentRequirement field is populated.\n${report}`,
      )
    }
  })
})
