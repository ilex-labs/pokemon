import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const dataRoot = path.join(root, 'src', 'data')

const errors = []

function fail(message) {
  errors.push(message)
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (err) {
    fail(`cannot read ${path.relative(root, filePath)}: ${err.message}`)
    return null
  }
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

/** Visit every object key in a JSON value. jsonPath is dotted, arrays use [i]. */
function walkJson(value, visit, jsonPath = '') {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const next = jsonPath ? `${jsonPath}[${index}]` : `[${index}]`
      walkJson(item, visit, next)
    }
    return
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      const next = jsonPath ? `${jsonPath}.${key}` : key
      visit(key, child, next, value)
      walkJson(child, visit, next)
    }
  }
}

/** Independent lineages from section 12 — aggregators are not valid second sources. */
const ALLOWED_SOURCES = new Set([
  'pokeapi',
  'bulbapedia',
  'serebii',
  'smogon',
  'game',
])

const ALLOWED_SOURCES_HINT = 'pokeapi|bulbapedia|serebii|smogon|game'

/** Claims with no governing category at migration — report, do not invent. */
export const KNOWN_UNSOURCED = new Set([
  'firered-leafgreen:generation',
  'firered-leafgreen:noEggRateBoostsReason',
  'scarlet-violet:generation',
])

const GEN3_REQUIRED_SOURCED = [
  'natureLock.method',
  'hatchLevel',
  'baseShinyOdds.odds',
  'baseShinyOdds.approximateEggs',
  'masudaMethod',
]

const GEN9_REQUIRED_SOURCED = [
  'abilityInheritance.inheritanceExists',
  'abilityInheritance.hiddenAbilityViaEggs',
  'abilityInheritance.abilityCapsuleAvailable',
  'abilityInheritance.abilityPatchAvailable',
  'abilityInheritance.standardOdds',
  'abilityInheritance.hiddenOdds',
  'abilityInheritance.maleOrGenderlessNeedsDitto',
  'hatchLevel',
  'baseShinyOdds.odds',
  'baseShinyOdds.approximateEggs',
  'masudaMethod.odds',
  'masudaMethod.approximateEggs',
]

export function isSourcedLeaf(node) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return false
  const keys = Object.keys(node)
  if (!keys.includes('value') || !keys.includes('src')) return false
  if (!keys.every((key) => key === 'value' || key === 'src' || key === 'note')) {
    return false
  }
  if (!Array.isArray(node.src)) return false
  if (node.note !== undefined && typeof node.note !== 'string') return false
  return true
}

export function unwrapSourced(node) {
  if (Array.isArray(node)) return node.map(unwrapSourced)
  if (isSourcedLeaf(node)) return unwrapSourced(node.value)
  if (node && typeof node === 'object') {
    const out = {}
    for (const [key, child] of Object.entries(node)) {
      const value = unwrapSourced(child)
      if (key === 'masudaMethod' && value === null) continue
      out[key] = value
    }
    return out
  }
  return node
}

export function sourcedLeafErrors(label, jsonPath, leaf) {
  const path = `${label}: ${jsonPath}`
  const found = []
  if (!isSourcedLeaf(leaf)) {
    found.push(
      `${path} is a claim and must carry provenance (src: two lineages, or one plus note)`,
    )
    return found
  }

  const sources = leaf.src
  if (!Array.isArray(sources) || sources.length === 0) {
    found.push(
      `${path} must list at least two independent sources (got ${JSON.stringify(sources)})`,
    )
    return found
  }

  if (sources.length === 1) {
    if (!isNonEmptyString(leaf.note)) {
      found.push(`${path} has a single source and requires a note`)
    }
  } else if (new Set(sources).size < 2) {
    found.push(
      `${path} must list at least two distinct sources (got ${JSON.stringify(sources)})`,
    )
  }

  for (const source of sources) {
    if (!ALLOWED_SOURCES.has(source)) {
      found.push(
        `${path} source "${source}" is not an allowed independent lineage (use ${ALLOWED_SOURCES_HINT})`,
      )
    }
  }
  return found
}

function lastKey(jsonPath) {
  const match = jsonPath.match(/\.([^.[\]]+)$/)
  return match ? match[1] : jsonPath
}

function isExemptPath(jsonPath, value) {
  if (jsonPath === 'id' || jsonPath === 'displayName') return true
  if (jsonPath === 'postgame' && Array.isArray(value) && value.length === 0) {
    return true
  }
  if (jsonPath === 'hatchRoutes' && Array.isArray(value) && value.length === 0) {
    return true
  }
  const key = lastKey(jsonPath)
  if (key === 'id' || key === 'type' || key === 'external') return true
  if (key === 'singleSource' || key === 'singleSourceReason') return true
  if (key === 'noun' || key === 'routeName') return true
  if (
    key === 'name' &&
    /eggEfficiencyModifiers\[\d+\]\.name$/.test(jsonPath)
  ) {
    return true
  }
  return false
}

function readPath(obj, jsonPath) {
  let current = obj
  for (const part of jsonPath.split('.')) {
    if (current == null || typeof current !== 'object') return undefined
    current = current[part]
  }
  return current
}

function missingClaimError(label, jsonPath) {
  return `${label}: ${jsonPath} is a claim and must carry provenance (src: two lineages, or one plus note)`
}

/**
 * Walk game JSON. Every non-exempt leaf must be a sourced claim, except
 * KNOWN_UNSOURCED (listed in the review report, not invented here).
 */
export function gameProvenanceErrors(label, game) {
  const found = []
  const unsourced = []
  let sourcedCount = 0

  if (game?.provenance !== undefined) {
    found.push(
      `${label}: provenance block must be removed — provenance lives on each claim leaf`,
    )
  }
  if (game?.provenanceNotes !== undefined) {
    found.push(
      `${label}: provenanceNotes must be removed — notes live on the sourced leaf`,
    )
  }

  function visit(node, jsonPath) {
    if (jsonPath === 'provenance' || jsonPath === 'provenanceNotes') return
    if (isSourcedLeaf(node)) {
      sourcedCount += 1
      found.push(...sourcedLeafErrors(label, jsonPath, node))
      return
    }
    if (jsonPath && isExemptPath(jsonPath, node)) return

    if (Array.isArray(node)) {
      for (const [index, item] of node.entries()) {
        visit(item, `${jsonPath}[${index}]`)
      }
      return
    }
    if (node && typeof node === 'object') {
      for (const [key, child] of Object.entries(node)) {
        const next = jsonPath ? `${jsonPath}.${key}` : key
        visit(child, next)
      }
      return
    }

    if (!jsonPath) return
    const id = `${label}:${jsonPath}`
    if (KNOWN_UNSOURCED.has(id)) {
      unsourced.push(jsonPath)
      return
    }
    found.push(missingClaimError(label, jsonPath))
  }

  visit(game, '')
  return { errors: found, unsourced, sourcedCount }
}

function walkSourcedLeaves(node, jsonPath, visitLeaf) {
  if (isSourcedLeaf(node)) {
    visitLeaf(jsonPath, node)
    return
  }
  if (Array.isArray(node)) {
    for (const [index, item] of node.entries()) {
      walkSourcedLeaves(item, `${jsonPath}[${index}]`, visitLeaf)
    }
    return
  }
  if (node && typeof node === 'object') {
    for (const [key, child] of Object.entries(node)) {
      const next = jsonPath ? `${jsonPath}.${key}` : key
      walkSourcedLeaves(child, next, visitLeaf)
    }
  }
}

export function rulesetProvenanceErrors(rel, ruleset) {
  const found = []
  let sourcedCount = 0

  walkSourcedLeaves(ruleset, '', (jsonPath, leaf) => {
    sourcedCount += 1
    found.push(...sourcedLeafErrors(rel, jsonPath, leaf))
  })

  const generation = isSourcedLeaf(ruleset?.generation)
    ? ruleset.generation.value
    : ruleset?.generation
  const required =
    typeof generation === 'number' && generation >= 4
      ? GEN9_REQUIRED_SOURCED
      : GEN3_REQUIRED_SOURCED

  for (const jsonPath of required) {
    const node = readPath(ruleset, jsonPath)
    if (!isSourcedLeaf(node)) {
      found.push(missingClaimError(rel, jsonPath))
    }
  }

  return { errors: found, sourcedCount }
}

function validateNatures(natures) {
  if (!natures || typeof natures !== 'object') {
    fail('natures.json: expected an object catalog')
    return
  }

  const names = Object.keys(natures)
  if (names.length === 0) {
    fail('natures.json: catalog is empty')
  }

  for (const [name, effect] of Object.entries(natures)) {
    if (!effect || typeof effect !== 'object') {
      fail(`natures.json: ${name} must be an object with raises/lowers`)
      continue
    }
    const { raises, lowers } = effect
    const raisesOk = raises === null || isNonEmptyString(raises)
    const lowersOk = lowers === null || isNonEmptyString(lowers)
    if (!raisesOk || !lowersOk) {
      fail(
        `natures.json: ${name} must describe raises/lowers (string or null) — nature description missing or malformed`,
      )
    }
  }
}

function validateIvPresets(presets) {
  if (!Array.isArray(presets)) {
    fail('iv-presets.json: expected an array')
    return
  }

  for (const preset of presets) {
    if (!preset?.id || !preset?.label || !preset?.rationale || !preset?.values) {
      fail(`iv-presets.json: preset missing required fields (${preset?.id ?? 'unknown'})`)
      continue
    }
    for (const [stat, value] of Object.entries(preset.values)) {
      if (value !== 'any' && value !== 'max' && typeof value !== 'number') {
        fail(
          `iv-presets.json: ${preset.id}.values.${stat} must be "any", "max", or a number`,
        )
      }
    }
  }
}

function validateRuleset(filePath, raw) {
  if (!raw) return
  const rel = path.relative(root, filePath)
  const provenance = rulesetProvenanceErrors(rel, raw)
  for (const error of provenance.errors) fail(error)

  const ruleset = unwrapSourced(raw)
  if (typeof ruleset.generation !== 'number') {
    fail(`${rel}: generation must be a number`)
  }
  const ai = ruleset.abilityInheritance
  if (!ai || typeof ai !== 'object') {
    fail(`${rel}: abilityInheritance is required`)
    return
  }
  for (const key of ['standardOdds', 'hiddenOdds']) {
    if (typeof ai[key] !== 'number' || ai[key] < 0 || ai[key] > 1) {
      fail(`${rel}: abilityInheritance.${key} must be a number between 0 and 1`)
    }
  }
  if (typeof ai.maleOrGenderlessNeedsDitto !== 'boolean') {
    fail(`${rel}: abilityInheritance.maleOrGenderlessNeedsDitto must be a boolean`)
  }
  if ('inheritanceOdds' in ai) {
    fail(
      `${rel}: abilityInheritance.inheritanceOdds is removed — use standardOdds and hiddenOdds`,
    )
  }
  if (
    typeof ruleset.hatchLevel !== 'number' ||
    !Number.isInteger(ruleset.hatchLevel) ||
    ruleset.hatchLevel < 1
  ) {
    fail(`${rel}: hatchLevel must be an integer >= 1`)
  }

  const lock = ruleset.natureLock
  if (!lock || typeof lock !== 'object') {
    fail(`${rel}: natureLock is required`)
  } else if (lock.method === 'everstone-chance') {
    if (
      typeof lock.passOdds !== 'number' ||
      !(lock.passOdds > 0 && lock.passOdds < 1)
    ) {
      fail(
        `${rel}: natureLock.method "everstone-chance" requires passOdds in (0, 1)`,
      )
    }
  } else if (lock.method === 'everstone-guaranteed') {
    if ('passOdds' in lock && lock.passOdds !== 1) {
      fail(
        `${rel}: natureLock.method "everstone-guaranteed" omits passOdds or sets 1`,
      )
    }
  }

  function validateOdds(label, value) {
    if (!value || typeof value !== 'object') {
      fail(`${rel}: ${label} must be an object with odds and approximateEggs`)
      return
    }
    if (!isNonEmptyString(value.odds) || !value.odds.includes('/')) {
      fail(`${rel}: ${label}.odds must be a fraction string (got ${JSON.stringify(value.odds)})`)
    }
    if (typeof value.approximateEggs !== 'number' || value.approximateEggs < 1) {
      fail(`${rel}: ${label}.approximateEggs must be a positive number`)
    }
  }

  validateOdds('baseShinyOdds', ruleset.baseShinyOdds)
  if (typeof ruleset.generation === 'number' && ruleset.generation >= 4) {
    if (!ruleset.masudaMethod) {
      fail(`${rel}: generation ${ruleset.generation} must include masudaMethod (introduced gen 4)`)
    } else {
      validateOdds('masudaMethod', ruleset.masudaMethod)
    }
  } else if (ruleset.masudaMethod) {
    fail(`${rel}: masudaMethod must be omitted before generation 4`)
  }

  walkJson(ruleset, (key, _value, jsonPath) => {
    if (key !== 'gate') return
    fail(
      `${rel}: ${jsonPath} cannot appear on a generation ruleset — gates belong on the game file; a game-specific gate on a generation-level capability goes in rulesetOverrides`,
    )
  })
}

function validateGame(filePath, raw, natures) {
  if (!raw) return
  const label = raw.id ?? path.basename(filePath, '.json')

  const provenance = gameProvenanceErrors(label, raw)
  for (const error of provenance.errors) fail(error)

  const game = unwrapSourced(raw)
  if (!game.ditto || typeof game.ditto !== 'object') {
    fail(`${label}: ditto is required`)
  } else if (typeof game.ditto.available !== 'boolean') {
    fail(`${label}: ditto.available must be a boolean`)
  }

  if (!game.eggGroups || typeof game.eggGroups !== 'object') {
    fail(`${label}: eggGroups is required`)
  }
  if (!game.species || typeof game.species !== 'object') {
    fail(`${label}: species is required`)
  }
  if (!game.eggMoves || typeof game.eggMoves !== 'object') {
    fail(`${label}: eggMoves is required`)
  }
  if (!Array.isArray(game.hatchRoutes)) {
    fail(`${label}: hatchRoutes is required`)
  }

  const moveDescriptions = game.moveDescriptions ?? {}
  const abilityDescriptions = game.abilityDescriptions ?? {}

  const referencedMoves = new Set()
  if (game.eggMoves && typeof game.eggMoves === 'object') {
    for (const [species, entries] of Object.entries(game.eggMoves)) {
      if (!Array.isArray(entries)) {
        fail(`${label}: eggMoves.${species} must be an array`)
        continue
      }
      for (const entry of entries) {
        if (!entry?.move) {
          fail(`${label}: eggMoves.${species} has an entry without move`)
          continue
        }
        referencedMoves.add(entry.move)
      }
    }
  }

  for (const move of referencedMoves) {
    if (!isNonEmptyString(moveDescriptions[move])) {
      fail(
        `${label}: move "${move}" is referenced in eggMoves but has no moveDescriptions entry`,
      )
    }
  }

  const referencedAbilities = new Set()
  const knownNames = new Set()
  if (game.species && typeof game.species === 'object') {
    for (const name of Object.keys(game.species)) {
      knownNames.add(name)
    }
  }
  if (game.eggGroups && typeof game.eggGroups === 'object') {
    for (const members of Object.values(game.eggGroups)) {
      if (!Array.isArray(members)) continue
      for (const member of members) {
        if (typeof member === 'string' && member.trim().length > 0) {
          knownNames.add(member)
        }
      }
    }
  }

  if (game.species && typeof game.species === 'object') {
    for (const [speciesName, species] of Object.entries(game.species)) {
      if (!species?.abilities || !Array.isArray(species.abilities.standard)) {
        fail(`${label}: species.${speciesName}.abilities.standard is required`)
      } else {
        for (const ability of species.abilities.standard) {
          referencedAbilities.add(ability)
        }
        if (species.abilities.hidden) {
          referencedAbilities.add(species.abilities.hidden)
        }
      }

      const ratio = species?.genderRatio
      if (
        ratio !== 'genderless' &&
        ratio !== 'male-only' &&
        ratio !== 'female-only' &&
        !(
          ratio &&
          typeof ratio === 'object' &&
          typeof ratio.malePercent === 'number'
        )
      ) {
        fail(`${label}: species.${speciesName}.genderRatio is required`)
      }

      const offspring = species?.hatchesInto
      if (!isNonEmptyString(offspring)) {
        fail(`${label}: species.${speciesName}.hatchesInto is required`)
      } else if (!knownNames.has(offspring)) {
        fail(
          `${label}: species.${speciesName} hatchesInto "${offspring}", which is not present in this game's species catalog or eggGroups index`,
        )
      }
    }
  }

  if (game.eggMoves && typeof game.eggMoves === 'object') {
    for (const [speciesName, entries] of Object.entries(game.eggMoves)) {
      if (!Array.isArray(entries)) continue
      for (const entry of entries) {
        if (!Array.isArray(entry?.parentSpecies)) continue
        for (const parent of entry.parentSpecies) {
          if (!isNonEmptyString(parent)) {
            fail(
              `${label}: eggMoves.${speciesName} has a parentSpecies entry that is not a name`,
            )
            continue
          }
          if (!knownNames.has(parent)) {
            fail(
              `${label}: eggMoves.${speciesName} parentSpecies "${parent}", which is not present in this game's species catalog or eggGroups index`,
            )
          }
        }
      }
    }
  }

  for (const ability of referencedAbilities) {
    if (!isNonEmptyString(abilityDescriptions[ability])) {
      fail(
        `${label}: ability "${ability}" is referenced on a species (standard or hidden) but has no abilityDescriptions entry`,
      )
    }
  }

  for (const [ability, description] of Object.entries(abilityDescriptions)) {
    if (!isNonEmptyString(description)) {
      fail(
        `${label}: ability "${ability}" is listed in abilityDescriptions but has no description`,
      )
    }
  }

  const ALLOWED_AFFECTS = new Set(['egg-rate', 'hatch-speed', 'step-pace'])
  for (const [index, modifier] of (game.eggEfficiencyModifiers ?? []).entries()) {
    if (!modifier || typeof modifier !== 'object') {
      fail(`${label}: eggEfficiencyModifiers[${index}] must be an object`)
      continue
    }
    if (!Array.isArray(modifier.affects) || modifier.affects.length === 0) {
      fail(
        `${label}: eggEfficiencyModifiers[${index}] ("${modifier.name ?? 'unnamed'}") affects must be a non-empty array`,
      )
    } else {
      for (const [affectIndex, affect] of modifier.affects.entries()) {
        if (!ALLOWED_AFFECTS.has(affect)) {
          fail(
            `${label}: eggEfficiencyModifiers[${index}].affects[${affectIndex}] is "${affect}", which is not one of egg-rate, hatch-speed, step-pace`,
          )
        }
      }
    }
    if (modifier.type === 'ability') {
      if (
        !Array.isArray(modifier.exampleHolders) ||
        modifier.exampleHolders.length === 0
      ) {
        fail(
          `${label}: eggEfficiencyModifiers[${index}] ("${modifier.name ?? 'unnamed'}") has type "ability" but is missing exampleHolders — name obtainable species and where to find them`,
        )
      } else {
        for (const [holderIndex, holder] of modifier.exampleHolders.entries()) {
          const path = `${label}: eggEfficiencyModifiers[${index}].exampleHolders[${holderIndex}]`
          if (typeof holder === 'string') {
            fail(
              `${path} must be an object { species, place, abilities }, not a string`,
            )
            continue
          }
          if (!holder || typeof holder !== 'object' || Array.isArray(holder)) {
            fail(`${path} must be an object { species, place, abilities }`)
            continue
          }
          if (!isNonEmptyString(holder.species)) {
            fail(`${path}.species must be a non-empty string`)
          }
          if (!isNonEmptyString(holder.place)) {
            fail(`${path}.place must be a non-empty string`)
          }
          if (!Array.isArray(holder.abilities) || holder.abilities.length === 0) {
            fail(`${path}.abilities must be a non-empty array of ability names`)
          } else {
            for (const [abilityIndex, ability] of holder.abilities.entries()) {
              if (!isNonEmptyString(ability)) {
                fail(
                  `${path}.abilities[${abilityIndex}] must be a non-empty string`,
                )
              }
            }
          }
          if ('external' in holder && holder.external !== true) {
            fail(`${path}.external must be true when set`)
          }
          const inCatalog =
            isNonEmptyString(holder.species) && knownNames.has(holder.species)
          if (inCatalog && holder.external === true) {
            fail(
              `${path}: "${holder.species}" is in this game's species catalog or eggGroups — do not set external`,
            )
          }
          if (!inCatalog && holder.external !== true) {
            fail(
              `${path}: "${holder.species}" is not in this game's species catalog or eggGroups — set external: true`,
            )
          }
        }
      }
    }
  }

  const shinyMods = game.shinyEggModifiers
  if (shinyMods?.shinyCharmAvailable) {
    const charmOdds = shinyMods.shinyCharmOdds
    if (
      !charmOdds ||
      typeof charmOdds !== 'object' ||
      !isNonEmptyString(charmOdds.odds) ||
      !charmOdds.odds.includes('/') ||
      typeof charmOdds.approximateEggs !== 'number'
    ) {
      fail(
        `${label}: shinyCharmAvailable requires shinyCharmOdds with a verified odds fraction — do not derive it from roll count`,
      )
    }
  }
  if (
    typeof game.generation === 'number' &&
    game.generation < 4 &&
    !shinyMods?.shinyCharmAvailable &&
    !isNonEmptyString(game.noEggShinyBoostsReason)
  ) {
    fail(
      `${label}: games without Masuda and without a Shiny Charm must set noEggShinyBoostsReason (name the absent mechanics)`,
    )
  }

  const declaredGateIds = new Set()
  if (game.featureGates !== undefined) {
    if (!Array.isArray(game.featureGates)) {
      fail(`${label}: featureGates must be an array`)
    } else {
      for (const [index, gate] of game.featureGates.entries()) {
        if (!gate || typeof gate !== 'object') {
          fail(`${label}: featureGates[${index}] must be an object`)
          continue
        }
        if (!isNonEmptyString(gate.id)) {
          fail(`${label}: featureGates[${index}].id is required`)
          continue
        }
        if (declaredGateIds.has(gate.id)) {
          fail(`${label}: featureGates id "${gate.id}" is duplicated`)
        }
        declaredGateIds.add(gate.id)
        if (!isNonEmptyString(gate.noun)) {
          fail(`${label}: featureGates[${index}].noun is required`)
        }
        if (!isNonEmptyString(gate.unlockedAfter)) {
          fail(`${label}: featureGates[${index}].unlockedAfter is required`)
        }
      }
    }
  }

  walkJson(game, (key, value, jsonPath, parent) => {
    if (key !== 'gate') return
    if (!isNonEmptyString(value)) {
      fail(`${label}: ${jsonPath} must be a non-empty string gate id`)
      return
    }
    if (!declaredGateIds.has(value)) {
      fail(
        `${label}: ${jsonPath} references gate "${value}", which is not a declared featureGates id`,
      )
    }
    if (!parent || typeof parent !== 'object' || Array.isArray(parent)) return
    if (parent.available === false) {
      fail(
        `${label}: ${jsonPath} gates a capability that is not available (available: false)`,
      )
      return
    }
    const otherKeys = Object.keys(parent).filter((name) => name !== 'gate')
    if (otherKeys.length === 0) {
      fail(`${label}: ${jsonPath} gates an omitted capability`)
    }
  })

  // Natures: shared catalog is what the form offers when naturesExist.
  const natureNames = new Set(Object.keys(natures ?? {}))
  if (natureNames.size === 0) {
    fail(`${label}: natures catalog is empty — every offered nature must resolve to a description`)
  }
}

function main() {
  const naturesPath = path.join(dataRoot, 'shared', 'natures.json')
  const presetsPath = path.join(dataRoot, 'shared', 'iv-presets.json')
  const natures = readJson(naturesPath)
  const presets = readJson(presetsPath)

  validateNatures(natures)
  validateIvPresets(presets)

  const rulesetsDir = path.join(dataRoot, 'rulesets')
  for (const name of fs.readdirSync(rulesetsDir).filter((f) => f.endsWith('.json'))) {
    const filePath = path.join(rulesetsDir, name)
    validateRuleset(filePath, readJson(filePath))
  }

  const gamesDir = path.join(dataRoot, 'games')
  for (const name of fs.readdirSync(gamesDir).filter((f) => f.endsWith('.json'))) {
    const filePath = path.join(gamesDir, name)
    validateGame(filePath, readJson(filePath), natures)
  }

  const rulesetFiles = fs
    .readdirSync(rulesetsDir)
    .filter((f) => f.endsWith('.json'))
  const gameFiles = fs.readdirSync(gamesDir).filter((f) => f.endsWith('.json'))

  let sourcedLeaves = 0
  const unsourcedReview = []
  for (const name of rulesetFiles) {
    const filePath = path.join(rulesetsDir, name)
    sourcedLeaves += rulesetProvenanceErrors(
      path.relative(root, filePath),
      readJson(filePath),
    ).sourcedCount
  }
  for (const name of gameFiles) {
    const filePath = path.join(gamesDir, name)
    const game = readJson(filePath)
    const result = gameProvenanceErrors(game?.id ?? name, game)
    sourcedLeaves += result.sourcedCount
    for (const jsonPath of result.unsourced) {
      unsourcedReview.push(`${game?.id ?? name}:${jsonPath}`)
    }
  }

  if (errors.length > 0) {
    console.error('validate: FAILED')
    for (const error of errors) {
      console.error(`  ✗ ${error}`)
    }
    process.exit(1)
  }

  console.log('validate: ok')
  console.log(`  natures: ${Object.keys(natures).length}`)
  console.log(`  iv-presets: ${presets.length}`)
  console.log(`  rulesets: ${rulesetFiles.length}`)
  console.log(`  games: ${gameFiles.length}`)
  console.log(`  sourced leaves: ${sourcedLeaves}`)
  if (unsourcedReview.length > 0) {
    console.log(`  unsourced (review): ${unsourcedReview.join(', ')}`)
  }
}

const isDirectRun =
  process.argv[1] != null &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
if (isDirectRun) {
  main()
}
