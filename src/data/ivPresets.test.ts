/**
 * filterIvPresets must drop presets the generation cannot use.
 * Counts are not asserted — a new preset must not break this file.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { IvPreset } from './schema'
import { filterIvPresets, gamesCatalog } from './loadGame'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
const sharedPresets = JSON.parse(
  readFileSync(join(ROOT, 'src/data/shared/iv-presets.json'), 'utf8'),
) as IvPreset[]

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
