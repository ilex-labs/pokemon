/**
 * Data shapes for rulesets, per-game catalogs, shared reference tables,
 * and in-session progress. Pure types only — no engine logic here.
 */

/** Unverified numeric placeholder — never quote as a real odds value in UI. */
export type TodoSentinel = 'TODO'

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
    /** Verified odds only — use `"TODO"` until sourced; never invent a percentage. */
    inheritanceOdds: number | TodoSentinel
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
  eggMoveMethod: 'eggs-only' | 'eggs-or-alternative'
}

export interface FeatureGate {
  feature: 'daycare' | 'move-reminder' | 'hidden-ability-access' | string
  unlockedAfter: string
}

export interface HatchModifier {
  name: string
  type: 'sandwich' | 'item' | 'other'
  effect: string
  recipeId?: string
  availability: string
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

export interface ShinyEggModifiers {
  masudaMethodAvailable: boolean
  shinyCharmAvailable: boolean
  shinyCharmStacksWithMasuda: boolean
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

export interface EggRateModifier {
  name: string
  effect: string
  availability: string
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

export interface RuleFlag {
  severity: 'info' | 'warning' | 'blocking'
  message: string
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
  }
  eggRateModifiers?: EggRateModifier[]
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
  hatchModifiers?: HatchModifier[]
  hatchMechanicExplainer?: string
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
  planSteps: PlanStep[]
  completedStepIds: string[]
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
