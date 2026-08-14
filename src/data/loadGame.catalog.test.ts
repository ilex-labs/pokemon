/**
 * UI/data catalog must stay derived from files — same promise as the engine
 * domain-literal guard. A hand-maintained game list left FRLG unselectable.
 */
import { readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { gamesCatalog } from './loadGame'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
const GAMES_DIR = join(ROOT, 'src/data/games')
const RULESETS_DIR = join(ROOT, 'src/data/rulesets')

describe('derived data catalogs', () => {
  it('gamesCatalog includes every src/data/games/*.json file', () => {
    const files = readdirSync(GAMES_DIR)
      .filter((name) => name.endsWith('.json'))
      .map((name) => name.replace(/\.json$/, ''))
      .sort()

    expect(files.length).toBeGreaterThan(0)
    expect(gamesCatalog.map((option) => option.id).sort()).toEqual(files)
    expect(
      gamesCatalog.every(
        (option) =>
          typeof option.displayName === 'string' &&
          option.displayName.length > 0 &&
          option.game.id === option.id &&
          option.ruleset.generation === option.game.generation,
      ),
    ).toBe(true)
  })

  it('every game resolves a ruleset from src/data/rulesets by generation', () => {
    const generations = new Set(
      readdirSync(RULESETS_DIR)
        .filter((name) => name.endsWith('.json'))
        .map((name) => {
          const match = /^gen(\d+)\.json$/.exec(name)
          return match ? Number(match[1]) : null
        })
        .filter((value): value is number => value != null),
    )

    for (const option of gamesCatalog) {
      expect(generations.has(option.game.generation)).toBe(true)
      expect(option.ruleset.generation).toBe(option.game.generation)
    }
  })
})
