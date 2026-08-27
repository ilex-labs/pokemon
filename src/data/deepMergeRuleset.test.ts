/**
 * Nested rulesetOverrides must merge into the generation object, not
 * replace it. A wholesale replace would drop destinyKnotAvailable and
 * the rest of ivInheritance when a game only overrides maxIv.
 */
import { describe, expect, it } from 'vitest'
import type { Ruleset } from './schema'
import gen9Json from './rulesets/gen9.json'
import { deepMergeRuleset } from './loadGame'

const gen9 = gen9Json as Ruleset

describe('deepMergeRuleset nested partials', () => {
  it('ivInheritance: { maxIv: 15 } merges into gen 9, it does not replace the object', () => {
    const merged = deepMergeRuleset(gen9, {
      ivInheritance: { maxIv: 15 },
    })

    expect(merged.ivInheritance.maxIv).toBe(15)
    expect(merged.ivInheritance.baseCountInherited).toBe(
      gen9.ivInheritance.baseCountInherited,
    )
    expect(merged.ivInheritance.destinyKnotBoostedCount).toBe(
      gen9.ivInheritance.destinyKnotBoostedCount,
    )
    expect(merged.ivInheritance.destinyKnotAvailable).toBe(true)
    expect(merged.ivInheritance.powerItemsAvailable).toBe(true)
    expect(merged.generation).toBe(9)
  })
})
