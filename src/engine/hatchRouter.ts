/**
 * Group egg-efficiency modifiers and hatch routes by the two levers
 * players care about: getting eggs faster, and hatching them faster.
 */

import type {
  AbilityHolder,
  EggEfficiencyModifier,
  GameData,
  HatchRoute,
} from '../data/schema'

export type EfficiencyLine = {
  name: string
  effect: string
  availability?: string
  /** Concrete ability holders (species + where) — required for ability modifiers. */
  exampleHolders?: AbilityHolder[]
  kind: 'modifier' | 'route'
  /** Human-readable hatch pace for routes. */
  paceLabel?: string
}

export type HatchEfficiencyView = {
  eggRate: EfficiencyLine[]
  hatchSpeed: EfficiencyLine[]
}

const CYCLE_PACE: Record<HatchRoute['cycleCount'], string> = {
  fast: 'quick hatch progress',
  medium: 'moderate hatch progress',
  slow: 'slow hatch progress',
}

const CYCLE_ORDER: Record<HatchRoute['cycleCount'], number> = {
  fast: 0,
  medium: 1,
  slow: 2,
}

/**
 * Dual-lever items may store lever-specific phrases separated by " · ".
 * Left side = egg-rate; right side = hatch-speed. Single-lever items use
 * the whole string under their only lever.
 */
function phraseForLever(
  modifier: EggEfficiencyModifier,
  lever: 'egg-rate' | 'hatch-speed',
): string {
  if (modifier.affects.length === 1) return modifier.effect

  const parts = modifier.effect.split(/\s·\s/).map((part) => part.trim())
  if (parts.length >= 2) {
    return lever === 'egg-rate' ? parts[0]! : parts[1]!
  }
  return modifier.effect
}

function lineFromModifier(
  modifier: EggEfficiencyModifier,
  lever: 'egg-rate' | 'hatch-speed',
): EfficiencyLine {
  return {
    name: modifier.name,
    effect: phraseForLever(modifier, lever),
    availability: modifier.availability,
    exampleHolders:
      modifier.exampleHolders && modifier.exampleHolders.length > 0
        ? modifier.exampleHolders.map((holder) => ({
            ...holder,
            abilities: [...holder.abilities],
          }))
        : undefined,
    kind: 'modifier',
  }
}

function lineFromRoute(route: HatchRoute): EfficiencyLine {
  return {
    name: route.routeName,
    effect: [route.method, route.notes].filter(Boolean).join(' '),
    kind: 'route',
    paceLabel: CYCLE_PACE[route.cycleCount],
  }
}

export function buildHatchEfficiency(game: GameData): HatchEfficiencyView {
  const modifiers = game.eggEfficiencyModifiers ?? []

  const eggRate = modifiers
    .filter((modifier) => modifier.affects.includes('egg-rate'))
    .map((modifier) => lineFromModifier(modifier, 'egg-rate'))

  const hatchSpeedMods = modifiers
    .filter((modifier) => modifier.affects.includes('hatch-speed'))
    .map((modifier) => lineFromModifier(modifier, 'hatch-speed'))

  const routes = [...game.hatchRoutes]
    .sort(
      (a, b) => CYCLE_ORDER[a.cycleCount] - CYCLE_ORDER[b.cycleCount],
    )
    .map(lineFromRoute)

  return {
    eggRate,
    hatchSpeed: [...hatchSpeedMods, ...routes],
  }
}
