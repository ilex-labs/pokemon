/**
 * filterIvPresets must drop presets the generation cannot use.
 * Counts are not asserted — a new preset must not break this file.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { IvPreset, Ruleset } from './schema'
import gen9Json from './rulesets/gen9.json'
import { filterIvPresets, gamesCatalog, resolvePresetValues } from './loadGame'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
const sharedPresets = JSON.parse(
  readFileSync(join(ROOT, 'src/data/shared/iv-presets.json'), 'utf8'),
) as IvPreset[]

const gen9 = gen9Json as Ruleset

/** Ceiling that neither shipped ruleset uses — 31 would not distinguish a hardcoded max. */
const fixtureRulesetMaxIv15: Ruleset = {
  ...gen9,
  ivInheritance: {
    ...gen9.ivInheritance,
    maxIv: 15,
  },
}

describe('filterIvPresets', () => {
  it('returns only presets available in each catalogued game\'s generation', () => {
    expect(gamesCatalog.length).toBeGreaterThan(0)
    expect(sharedPresets.length).toBeGreaterThan(0)

    for (const option of gamesCatalog) {
      const generation = option.game.generation
      const filtered = filterIvPresets(sharedPresets, generation)
      const filteredIds = new Set(filtered.map((preset) => preset.id))

      for (const preset of filtered) {
        expect(
          preset.availableFrom === undefined ||
            preset.availableFrom <= generation,
          `${option.id}: ${preset.id} has availableFrom ${preset.availableFrom} > gen ${generation}`,
        ).toBe(true)
      }

      for (const preset of sharedPresets) {
        if (preset.availableFrom !== undefined && preset.availableFrom > generation) {
          expect(
            filteredIds.has(preset.id),
            `${option.id}: ${preset.id} (availableFrom ${preset.availableFrom}) must be absent in gen ${generation}`,
          ).toBe(false)
        }
      }
    }
  })
})

describe('resolvePresetValues', () => {
  it('fixtureRulesetMaxIv15: symbolic max resolves to 15, not 31', () => {
    const allMax = sharedPresets.find((preset) => preset.id === 'all-max')
    expect(allMax).toBeDefined()

    const resolved = resolvePresetValues(
      allMax!.values,
      fixtureRulesetMaxIv15.ivInheritance.maxIv,
    )

    expect(fixtureRulesetMaxIv15.ivInheritance.maxIv).toBe(15)
    expect(resolved).toEqual({
      hp: 15,
      atk: 15,
      def: 15,
      spa: 15,
      spd: 15,
      spe: 15,
    })
    expect(Object.values(resolved)).not.toContain(31)
  })
})
