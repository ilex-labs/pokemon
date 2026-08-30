/**
 * Data shapes for rulesets, per-game catalogs, shared reference tables,
 * and in-session progress. Pure types only — no engine logic here.
 */

import type { Reason } from '../lib/reason'

export type NatureLock =
  | { method: 'none' }
  | {
      method: 'everstone-chance' | 'everstone-guaranteed'
      holder: 'female-or-ditto' | 'either-parent'
    }

export interface Ruleset {
  generation: number
  daycareAvailable: boolean
  gendersExist: boolean
  naturesExist: boolean
  abilitiesExist: boolean
  hiddenAbilitiesExist: boolean
  eggMovesExist: boolean
  eggMoveEligibleParents: 'male-only' | 'either-parent'
  natureLock: NatureLock
  abilityInheritance: {
    inheritanceExists: boolean
    hiddenAbilityViaEggs: boolean
    abilityCapsuleAvailable: boolean
    abilityPatchAvailable: boolean
    /** Female (or non-Ditto parent with Ditto) passes a standard ability slot. Gen 6+: 0.8. */
    standardOdds: number
    /** Hidden ability pass rate — lower than standard. Gen 6+: 0.6. */
    hiddenOdds: number
    /**
     * When true, a male or genderless parent passes its ability only with Ditto.
     * Species-pair cannot produce that ability unless a female carrier exists.
     */
    maleOrGenderlessNeedsDitto: boolean
  }
  ivInheritance: {
    maxIv: number
    baseCountInherited: number
    destinyKnotBoostedCount: number
    destinyKnotAvailable: boolean
    powerItemsAvailable: boolean
  }
  hyperTraining: {
    available: boolean
    levelRequired: number
  }
  /** Level of the Pokémon when the egg hatches — 5 in gens 2–3, 1 from gen 4 on. */
  hatchLevel: number
  eggMoveMethod: 'eggs-only' | 'eggs-or-alternative'
  /**
   * Base egg shiny rate for this generation. Gens 2–5: 1/8192; gen 6+: 1/4096.
   */
  baseShinyOdds: ShinyOddsTierData
  /**
   * Masuda Method odds — omit when the generation has no language-of-origin
   * boost (gen 3 and earlier; introduced in Diamond/Pearl).
   * Gen 4: 5/8192; gen 5: 6/8192; gen 6+: 6/4096.
   */
  masudaMethod?: ShinyOddsTierData
}

export interface FeatureGate {
  id: string
  /** Player-facing name in the banner — "Day Care", not a schema token. */
  noun: string
  unlockedAfter: string
}

/** Egg-rate and/or hatch-speed modifiers — one item may pull both levers. */
export interface EggEfficiencyModifier {
  name: string
  affects: Array<'egg-rate' | 'hatch-speed'>
  type: 'sandwich' | 'item' | 'ability' | 'other'
  effect: string
  availability: string
  /**
   * Required whenever type is "ability": obtainable-in-this-game species
   * (and where to find them). Never name an ability class alone.
   */
  exampleHolders?: string[]
  recipeId?: string
}

export interface SandwichRecipe {
  id: string
  name: string
  ingredients: string[]
  fillings: string[]
  condiments: string[]
  effects: string[]
  notes?: string
}

export type ShinyOddsTierData = {
  odds: string
  approximateEggs: number
}

export interface ShinyEggModifiers {
  shinyCharmAvailable: boolean
  shinyCharmStacksWithMasuda: boolean
  /**
   * Shiny Charm alone (no Masuda). Verified figure — never derived from
   * roll count. Gen 8/9 is 2/4096, not 3/4096, because of a reroll bug.
   * Omit when the charm is unavailable.
   */
  shinyCharmOdds?: ShinyOddsTierData
  /**
   * Masuda + Shiny Charm stacked odds. Omit when the charm is unavailable
   * or does not stack. Gen 6+: 8/4096; B2W2: 8/8192.
   */
  masudaPlusCharmOdds?: ShinyOddsTierData
  /**
   * What having the charm means in this game (completing a regional Pokédex).
   * Context only — never turned into a plan step. Shown on the Charm-alone
   * tier, not repeated on Masuda + Charm.
   */
  shinyCharmUnlock?: string
  /**
   * Extra Charm-alone copy. Omit rather than explain roll-count trivia —
   * provenance already records why the figure is what it is.
   */
  shinyCharmAloneNote?: string
  notes?: string
}

export interface SpeciesEggData {
  abilities: {
    standard: string[]
    hidden?: string
  }
  genderRatio:
    | 'genderless'
    | 'male-only'
    | 'female-only'
    | { malePercent: number }
  hatchesInto: string
  babyWithIncense?: string
  incenseItem?: string
  eggCycles?: number
}

export interface EggMoveEntry {
  move: string
  parentSpecies: string[]
}

export interface HatchRoute {
  routeName: string
  cycleCount: 'fast' | 'medium' | 'slow'
  method: string
  notes?: string
}

export interface PostgameItem {
  id: string
  category: 'legendary' | 'battle-facility' | 'side-story' | 'collectible' | 'story'
  title: string
  description: string
  prerequisiteIds?: string[]
}

export type RuleFlag = Reason & {
  severity: 'info' | 'warning' | 'blocking'
  /** Player claim met this flag — keep the line, render it satisfied. */
  satisfied?: boolean
}

export interface PlanStep {
  id: string
  order: number
  instruction: string
  ruleFlags?: RuleFlag[]
}

export interface IvPreset {
  id: string
  label: string
  /** `'max'` resolves from `ruleset.ivInheritance.maxIv` when a preset is applied. */
  values: Record<string, 'any' | 'max' | number>
  rationale: string
  availableFrom?: number
  rationaleByGeneration?: Record<number, string>
}

/** Encounter-based shiny hunting methods for the planned Shiny & Marks tool. */
export interface ShinyMethod {
  id: string
  name: string
  type: 'eggs' | 'encounter-chain' | 'static-boost' | 'other'
  oddsDescription: string
  requirements: string[]
  availableFrom: string
  notes?: string
}

/** Mark definitions for the planned Shiny & Marks tool. */
export interface Mark {
  id: string
  name: string
  category: 'weather' | 'time' | 'personality' | 'rare' | 'fixed-encounter' | string
  howObtained: string
  obtainableViaEggs: boolean
  canCoincideWithShiny: boolean
}

export interface GameData {
  id: string
  displayName: string
  generation: number
  rulesetOverrides?: Partial<Ruleset>
  eggGroups: Record<string, string[]>
  species: Record<string, SpeciesEggData>
  ditto: {
    available: boolean
    obtainedAt?: string
    universalParent: boolean
    /** Id of a game.featureGates entry. Omit when Ditto is not gated. */
    gate?: string
  }
  /** Present when ruleset.hyperTraining.available — how hard caps are to get here. */
  hyperTrainingAccess?: {
    bottleCap: string
    goldBottleCap: string
    effort: 'routine' | 'grindy' | 'rare'
  }
  /**
   * How to obtain a parent of a specific nature in THIS game.
   * Attached as an acquisition flag when the plan requires a nature.
   */
  natureAcquisition?: {
    how: string
  }
  /** Gen 8+ — Nature Mints exist; they do not change the nature eggs inherit. */
  mintsAvailable?: boolean
  /**
   * Species-determination facts for this game (section 12). Gender reasons on
   * parents are derived per constraint in the engine — these strings are the
   * sourced base facts, not copied verbatim onto every parent.
   */
  speciesDetermination?: {
    femaleDeterminesSpecies: string
    withDitto: string
  }
  /**
   * How to obtain a parent with a given ability when it isn't the species' only
   * standard slot. Hidden abilities always need this.
   */
  abilityAcquisition?: {
    hidden?: string
    standard?: string
  }
  /** How to get egg moves onto a parent in THIS game when they aren't level-up moves. */
  eggMoveAcquisition?: {
    how: string
  }
  /**
   * How to obtain a parent whose origin language differs from its partner
   * (Masuda). Acquisition only — do not restate the parent-card constraint.
   * Say that they may already have one, with a concrete example, then how
   * to get a parent otherwise. Do not restate that languages must differ.
   */
  masudaAcquisition?: {
    how: string
  }
  eggEfficiencyModifiers?: EggEfficiencyModifier[]
  eggMoves: Record<string, EggMoveEntry[]>
  /** Present iff the ruleset's eggMoveMethod is "eggs-or-alternative". */
  eggMoveAlternative?: {
    name: string
    howItWorks: string
  }
  moveDescriptions?: Record<string, string>
  abilityDescriptions?: Record<string, string>
  ivPresets?: IvPreset[]
  hatchRoutes: HatchRoute[]
  /**
   * Plain-language walkthrough of how eggs appear and hatch in this game.
   * Rendered with hatch efficiency — write one per game; do not leave the
   * heading empty by omission.
   */
  hatchMechanicExplainer?: string
  /**
   * When this game genuinely has no egg-appearance boost (no Oval Charm,
   * sandwich, etc.), set this so the UI can say so definitively instead of
   * reading like missing data.
   */
  noEggRateBoostsReason?: string
  /**
   * When this game has no Masuda and no Shiny Charm, name what is absent
   * (introduced-in-gen, no Charm) so the panel does not read as a data gap.
   */
  noEggShinyBoostsReason?: string
  sandwichRecipes?: SandwichRecipe[]
  shinyEggModifiers?: ShinyEggModifiers
  featureGates?: FeatureGate[]
  shinyMethods?: ShinyMethod[]
  marks?: Mark[]
  postgame: PostgameItem[]
  uniqueMechanics?: string[]
  provenance: Record<string, string[]>
}

export interface DaycareProject {
  id: string
  gameId: string
  targetSpread: {
    species: string
    nature: string
    ability: string
    eggMoves: string[]
    /** Resolved IV targets only — `'max'` from presets is expanded at selection time. */
    ivs: Record<string, 'any' | number>
    wantsShiny?: boolean
  }
  completedStepIds: string[]
  /** Parent roles the user already owns — "I already have this" toggles. Default none. */
  ownedParentRoles: Array<'A' | 'B'>
}

export interface PostgameProgress {
  gameId: string
  saveSlotName: string
  completedItemIds: string[]
}

/** Shared natures.json entry — raised/lowered stat names, or null for neutrals. */
export interface NatureEffect {
  raises: string | null
  lowers: string | null
}

export type NaturesCatalog = Record<string, NatureEffect>
