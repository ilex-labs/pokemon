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

/** Independent lineages from section 12 — aggregators are not valid second sources. */
const ALLOWED_SOURCES = new Set([
  'pokeapi',
  'bulbapedia',
  'serebii',
  'smogon',
  'game',
])

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

function validateRuleset(filePath, ruleset) {
  if (!ruleset) return
  const rel = path.relative(root, filePath)
  if (typeof ruleset.generation !== 'number') {
    fail(`${rel}: generation must be a number`)
  }
  const odds = ruleset.abilityInheritance?.inheritanceOdds
  if (odds !== 'TODO' && typeof odds !== 'number') {
    fail(`${rel}: abilityInheritance.inheritanceOdds must be a number or "TODO"`)
  }
}

function validateGame(filePath, game, natures) {
  if (!game) return
  const rel = path.relative(root, filePath)
  const label = game.id ?? path.basename(filePath, '.json')

  if (!game.provenance || typeof game.provenance !== 'object') {
    fail(`${label}: provenance block is required`)
  } else {
    const categories = Object.keys(game.provenance)
    if (categories.length === 0) {
      fail(`${label}: provenance block is empty`)
    }
    for (const [category, sources] of Object.entries(game.provenance)) {
      if (!Array.isArray(sources) || sources.length < 2) {
        fail(
          `${label}: provenance.${category} must list at least two independent sources (got ${JSON.stringify(sources)})`,
        )
        continue
      }
      const unique = new Set(sources)
      if (unique.size < 2) {
        fail(
          `${label}: provenance.${category} must list at least two distinct sources (got ${JSON.stringify(sources)})`,
        )
      }
      for (const source of sources) {
        if (!ALLOWED_SOURCES.has(source)) {
          fail(
            `${label}: provenance.${category} source "${source}" is not an allowed independent lineage (use pokeapi|bulbapedia|serebii|smogon|game)`,
          )
        }
      }
    }
  }

  const moveDescriptions = game.moveDescriptions ?? {}
  const abilityDescriptions = game.abilityDescriptions ?? {}

  const referencedMoves = new Set()
  for (const [species, entries] of Object.entries(game.eggMoves ?? {})) {
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

  for (const move of referencedMoves) {
    if (!isNonEmptyString(moveDescriptions[move])) {
      fail(
        `${label}: move "${move}" is referenced in eggMoves but has no moveDescriptions entry`,
      )
    }
  }

  const referencedAbilities = new Set()
  for (const [speciesName, species] of Object.entries(game.species ?? {})) {
    if (!species?.abilities || !Array.isArray(species.abilities.standard)) {
      fail(`${label}: species.${speciesName}.abilities.standard is required`)
      continue
    }
    for (const ability of species.abilities.standard) {
      referencedAbilities.add(ability)
    }
    if (species.abilities.hidden) {
      referencedAbilities.add(species.abilities.hidden)
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
  console.log(
    `  rulesets: ${fs.readdirSync(rulesetsDir).filter((f) => f.endsWith('.json')).length}`,
  )
  console.log(
    `  games: ${fs.readdirSync(gamesDir).filter((f) => f.endsWith('.json')).length}`,
  )
}

main()
