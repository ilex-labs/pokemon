import type { GameData, Ruleset } from './schema'
import { unwrapSourced } from './unwrapSourced'
import frlgJson from './games/firered-leafgreen.json'
import svJson from './games/scarlet-violet.json'
import gen3Json from './rulesets/gen3.json'
import gen9Json from './rulesets/gen9.json'

export const frlg = unwrapSourced(frlgJson) as GameData
export const scarletViolet = unwrapSourced(svJson) as GameData
export const gen3 = unwrapSourced(gen3Json) as Ruleset
export const gen9 = unwrapSourced(gen9Json) as Ruleset
